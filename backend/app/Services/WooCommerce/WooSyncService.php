<?php

namespace App\Services\WooCommerce;

use App\Models\WooCategory;
use App\Models\WooCoupon;
use App\Models\WooCustomer;
use App\Models\WooOrder;
use App\Models\WooOrderItem;
use App\Models\WooProduct;
use App\Models\WooSyncLog;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Pulls data FROM WooCommerce into the local mirror tables.
 * Nothing here ever sends data to WooCommerce.
 */
class WooSyncService
{
    public const RESOURCES = ['categories', 'products', 'customers', 'orders', 'coupons'];

    public function __construct(private WooClient $woo) {}

    /** @return int number of records synced */
    public function sync(string $resource, ?string $modifiedAfter = null): int
    {
        $log = WooSyncLog::create(['resource' => $resource, 'status' => 'running', 'started_at' => now()]);

        try {
            $count = match ($resource) {
                'categories' => $this->categories(),
                'products' => $this->products($modifiedAfter),
                'customers' => $this->customers(),
                'orders' => $this->orders($modifiedAfter),
                'coupons' => $this->coupons(),
            };
            $log->update(['status' => 'ok', 'records' => $count, 'finished_at' => now()]);

            return $count;
        } catch (Throwable $e) {
            $log->update(['status' => 'failed', 'error' => mb_substr($e->getMessage(), 0, 2000), 'finished_at' => now()]);
            throw $e;
        }
    }

    private function categories(): int
    {
        $n = 0;
        foreach ($this->woo->paginate('products/categories') as $c) {
            $this->storeCategory($c);
            $n++;
        }

        return $n;
    }

    private function persistCategory(array $c): WooCategory
    {
        return WooCategory::updateOrCreate(['woo_id' => $c['id']], [
            'parent_woo_id' => $c['parent'] ?? 0,
            'name' => html_entity_decode($c['name']),
            'slug' => $c['slug'],
            'description' => ($c['description'] ?? '') !== '' ? $c['description'] : null,
            'products_count' => $c['count'] ?? 0,
            'image_url' => $c['image']['src'] ?? null,
        ]);
    }

    private function products(?string $modifiedAfter): int
    {
        $query = $modifiedAfter ? ['modified_after' => $modifiedAfter] : [];
        $n = 0;
        foreach ($this->woo->paginate('products', $query) as $p) {
            $this->storeProduct($p);
            $n++;
        }

        return $n;
    }

    /** Save one WooCommerce product payload into the local mirror (local DB only). */
    private function persistProduct(array $p): WooProduct
    {
        return DB::transaction(function () use ($p) {
            $product = WooProduct::updateOrCreate(['woo_id' => $p['id']], [
                'name' => html_entity_decode($p['name']),
                'slug' => $p['slug'],
                'type' => $p['type'],
                'status' => $p['status'],
                'sku' => $p['sku'] ?: null,
                'price' => $this->money($p['price'] ?? null),
                'regular_price' => $this->money($p['regular_price'] ?? null),
                'sale_price' => $this->money($p['sale_price'] ?? null),
                'on_sale' => (bool) ($p['on_sale'] ?? false),
                'stock_status' => $p['stock_status'] ?? 'instock',
                'manage_stock' => (bool) ($p['manage_stock'] ?? false),
                'stock_quantity' => $p['stock_quantity'] ?? null,
                'total_sales' => $p['total_sales'] ?? 0,
                'average_rating' => $p['average_rating'] ?? 0,
                'rating_count' => $p['rating_count'] ?? 0,
                'image_url' => $p['images'][0]['src'] ?? null,
                'permalink' => $p['permalink'] ?? null,
                'woo_created_at' => $this->date($p['date_created_gmt'] ?? null),
                'woo_modified_at' => $this->date($p['date_modified_gmt'] ?? null),
                'raw' => $p,
            ]);

            DB::table('woo_category_product')->where('product_woo_id', $p['id'])->delete();
            $rows = collect($p['categories'] ?? [])->map(fn ($c) => ['product_woo_id' => $p['id'], 'category_woo_id' => $c['id']])->all();
            if ($rows) {
                DB::table('woo_category_product')->insert($rows);
            }

            return $product;
        });
    }

    private function customers(): int
    {
        $n = 0;
        foreach ($this->woo->paginate('customers') as $c) {
            $this->storeCustomer($c);
            $n++;
        }

        return $n;
    }

    private function persistCustomer(array $c): WooCustomer
    {
        return WooCustomer::updateOrCreate(['woo_id' => $c['id']], [
            'email' => $c['email'] ?: null,
            'first_name' => $c['first_name'] ?: null,
            'last_name' => $c['last_name'] ?: null,
            'username' => $c['username'] ?: null,
            'role' => $c['role'] ?? null,
            'phone' => $c['billing']['phone'] ?? null,
            'city' => $c['billing']['city'] ?? null,
            'state' => $c['billing']['state'] ?? null,
            'country' => $c['billing']['country'] ?? null,
            'orders_count' => $c['orders_count'] ?? 0,
            'total_spent' => $c['total_spent'] ?? 0,
            'woo_created_at' => $this->date($c['date_created_gmt'] ?? null),
            'raw' => $c,
        ]);
    }

    private function orders(?string $modifiedAfter): int
    {
        $query = ['status' => 'any'] + ($modifiedAfter ? ['modified_after' => $modifiedAfter] : []);
        $n = 0;
        foreach ($this->woo->paginate('orders', $query) as $o) {
            $this->storeOrder($o);
            $n++;
        }

        return $n;
    }

    private function persistOrder(array $o): WooOrder
    {
        return DB::transaction(function () use ($o) {
            $b = $o['billing'] ?? [];
            $s = $o['shipping'] ?? [];
            $meta = collect($o['meta_data'] ?? [])->mapWithKeys(
                fn ($m) => isset($m['key']) ? [$m['key'] => $m['value'] ?? null] : []
            );
            $dashboardStatus = $meta->get('_dashboard_status');
            $wooStatus = $o['status'] ?? 'pending';
            $resolvedStatus = match (true) {
                $wooStatus === 'processing' && $dashboardStatus === 'in-processing' => 'in-processing',
                $wooStatus === 'processing' && $dashboardStatus === 'out-for-delivery' => 'out-for-delivery',
                $wooStatus === 'processing' && ($dashboardStatus === 'dispatch' || $meta->get('_order_dispatched') === 'yes') => 'dispatch',
                default => $wooStatus,
            };
            $isDispatched = in_array($resolvedStatus, ['dispatch', 'out-for-delivery', 'completed'], true);
            $existing = WooOrder::where('woo_id', $o['id'])->first();

            $order = WooOrder::updateOrCreate(['woo_id' => $o['id']], [
                'number' => $o['number'],
                'status' => $resolvedStatus,
                'courier_name' => $meta->get('_courier_name') ?: $existing?->courier_name,
                'tracking_number' => $meta->get('_tracking_number') ?: $existing?->tracking_number,
                'dispatched_at' => $isDispatched ? ($existing?->dispatched_at ?? now()) : $existing?->dispatched_at,
                'currency' => $o['currency'] ?? null,
                'total' => $o['total'] ?? 0,
                // How much of the order WooCommerce says was refunded: sales figures are net of it.
                'refunded_total' => OrderRefunds::total($o),
                'discount_total' => $o['discount_total'] ?? 0,
                'shipping_total' => $o['shipping_total'] ?? 0,
                'total_tax' => $o['total_tax'] ?? 0,
                'payment_method' => $o['payment_method'] ?? null,
                'payment_method_title' => $o['payment_method_title'] ?? null,
                'transaction_id' => $o['transaction_id'] ?: null,
                'customer_woo_id' => $o['customer_id'] ?? 0,
                'billing_name' => trim(($b['first_name'] ?? '').' '.($b['last_name'] ?? '')) ?: null,
                'billing_email' => $b['email'] ?? null,
                'billing_phone' => $b['phone'] ?? null,
                'billing_city' => $b['city'] ?? null,
                'billing_state' => $b['state'] ?? null,
                'shipping_city' => $s['city'] ?? null,
                'shipping_state' => $s['state'] ?? null,
                'customer_note' => $o['customer_note'] ?: null,
                'coupon_codes' => collect($o['coupon_lines'] ?? [])->pluck('code')->all(),
                'woo_created_at' => $this->date($o['date_created_gmt'] ?? null),
                'woo_paid_at' => $this->date($o['date_paid_gmt'] ?? null),
                'woo_completed_at' => $this->date($o['date_completed_gmt'] ?? null),
                'raw' => $o,
            ]);

            WooOrderItem::where('order_woo_id', $o['id'])->delete();
            foreach ($o['line_items'] ?? [] as $i) {
                WooOrderItem::create([
                    'order_woo_id' => $o['id'],
                    'woo_item_id' => $i['id'],
                    'product_woo_id' => $i['product_id'] ?? 0,
                    'variation_woo_id' => $i['variation_id'] ?? 0,
                    'name' => $i['name'],
                    'sku' => $i['sku'] ?: null,
                    'quantity' => $i['quantity'] ?? 1,
                    'subtotal' => $i['subtotal'] ?? 0,
                    'total' => $i['total'] ?? 0,
                ]);
            }

            return $order;
        });
    }

    private function coupons(): int
    {
        $n = 0;
        foreach ($this->woo->paginate('coupons') as $c) {
            $this->storeCoupon($c);
            $n++;
        }

        return $n;
    }

    private function persistCoupon(array $c): WooCoupon
    {
        return WooCoupon::updateOrCreate(['woo_id' => $c['id']], [
            'code' => $c['code'],
            'status' => $c['status'] ?? null,
            'discount_type' => $c['discount_type'] ?? null,
            'amount' => $c['amount'] ?? 0,
            'usage_count' => $c['usage_count'] ?? 0,
            'usage_limit' => $c['usage_limit'] ?? null,
            'free_shipping' => (bool) ($c['free_shipping'] ?? false),
            'expires_at' => $this->date($c['date_expires_gmt'] ?? null),
            'woo_created_at' => $this->date($c['date_created_gmt'] ?? null),
            'raw' => $c,
        ]);
    }

    /**
     * Remove one record from the LOCAL mirror (used when WooCommerce reports it deleted).
     * Never contacts WooCommerce.
     */
    private function removeLocal(string $resource, int $wooId): void
    {
        DB::transaction(function () use ($resource, $wooId) {
            match ($resource) {
                'order' => [WooOrderItem::where('order_woo_id', $wooId)->delete(), WooOrder::where('woo_id', $wooId)->delete()],
                'product' => [DB::table('woo_category_product')->where('product_woo_id', $wooId)->delete(), WooProduct::where('woo_id', $wooId)->delete()],
                'customer' => WooCustomer::where('woo_id', $wooId)->delete(),
                'category' => [DB::table('woo_category_product')->where('category_woo_id', $wooId)->delete(), WooCategory::where('woo_id', $wooId)->delete()],
                'coupon' => WooCoupon::where('woo_id', $wooId)->delete(),
            };
        });
    }

    private function money(mixed $v): ?string
    {
        return ($v === null || $v === '') ? null : (string) $v;
    }

    private function date(?string $v): ?Carbon
    {
        return $v ? Carbon::parse($v, 'UTC') : null;
    }

    public function storeCategory(array $record): WooCategory
    {
        $model = $this->persistCategory($record);
        MirrorVersion::bump('categories');

        return $model;
    }

    public function storeProduct(array $record): WooProduct
    {
        $model = $this->persistProduct($record);
        MirrorVersion::bump('products');

        return $model;
    }

    public function storeCustomer(array $record): WooCustomer
    {
        $model = $this->persistCustomer($record);
        MirrorVersion::bump('customers');

        return $model;
    }

    public function storeOrder(array $record): WooOrder
    {
        $model = $this->persistOrder($record);
        MirrorVersion::bump('orders');

        return $model;
    }

    public function storeCoupon(array $record): WooCoupon
    {
        $model = $this->persistCoupon($record);
        MirrorVersion::bump('coupons');

        return $model;
    }

    /**
     * Remove one record from the LOCAL mirror (used when WooCommerce reports it deleted).
     * Never contacts WooCommerce.
     */
    public function forget(string $resource, int $wooId): void
    {
        $this->removeLocal($resource, $wooId);
        MirrorVersion::bump(['order' => 'orders', 'product' => 'products', 'customer' => 'customers', 'coupon' => 'coupons', 'category' => 'categories'][$resource]);
    }
}
