<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WooCustomer;
use App\Models\WooOrder;
use App\Models\WooOrderItem;
use App\Models\WooProduct;
use App\Models\WooSyncLog;
use App\Services\WooCommerce\StockRules;
use App\Services\WooCommerce\StoreCurrency;
use App\Services\WooCommerce\WooErrors;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use OpenApi\Attributes as OA;

class DashboardController extends Controller
{
    /** Statuses that count as "sales". */
    private const PAID = ['completed', 'processing', 'in-processing', 'dispatch', 'out-for-delivery'];

    #[OA\Get(
        path: '/api/v1/dashboard/summary',
        operationId: 'dashboardSummary',
        summary: 'Headline sales numbers for the last N days, compared with the N days before',
        description: 'Sales count orders with status `completed` or `processing`.',
        security: [['bearerAuth' => []]],
        tags: ['Dashboard'],
        parameters: [new OA\Parameter(name: 'days', in: 'query', schema: new OA\Schema(type: 'integer', minimum: 1, maximum: 365, default: 30))],
        responses: [
            new OA\Response(response: 200, description: 'OK', content: new OA\JsonContent(properties: [
                new OA\Property(property: 'days', type: 'integer', example: 30),
                new OA\Property(property: 'revenue', type: 'number', format: 'float', example: 18250.5),
                new OA\Property(property: 'previous_revenue', type: 'number', format: 'float', example: 12000),
                new OA\Property(property: 'orders', type: 'integer', example: 14),
                new OA\Property(property: 'previous_orders', type: 'integer', example: 9),
                new OA\Property(property: 'average_order_value', type: 'number', format: 'float', example: 1303.61),
                new OA\Property(property: 'refunded', type: 'number', format: 'float', description: 'Refunded on those orders (already subtracted from revenue)'),
                new OA\Property(property: 'paid_revenue', type: 'number', format: 'float', description: 'Revenue from orders WooCommerce has a payment date for'),
                new OA\Property(property: 'unpaid_revenue', type: 'number', format: 'float', description: 'Revenue from processing orders with no payment date yet (e.g. cash on delivery)'),
                new OA\Property(property: 'awaiting_fulfilment', type: 'integer', description: 'processing + on-hold + pending orders (all time)', example: 3),
                new OA\Property(property: 'customers', type: 'integer', example: 1),
                new OA\Property(property: 'currency', type: 'string', nullable: true, example: 'INR', description: 'ISO currency code from WooCommerce settings (or the latest order); null when unknown'),
                new OA\Property(property: 'published_products', type: 'integer', example: 95),
                new OA\Property(property: 'out_of_stock_products', type: 'integer', example: 4),
            ])),
            new OA\Response(response: 401, ref: '#/components/responses/Unauthenticated'),
        ],
    )]
    public function summary(Request $request): JsonResponse
    {
        if ($request->filled('date_from')) {
            $from = Carbon::parse($request->date_from)->startOfDay();
            $to = $request->filled('date_to') ? Carbon::parse($request->date_to)->endOfDay() : now()->endOfDay();
            $diffDays = max(1, (int) $from->diffInDays($to) + 1);
            $prevFrom = $from->copy()->subDays($diffDays);
            $prevTo = $from->copy()->subSecond();

            $current = WooOrder::whereIn('status', self::PAID)->whereBetween('woo_created_at', [$from, $to]);
            $previous = WooOrder::whereIn('status', self::PAID)->whereBetween('woo_created_at', [$prevFrom, $prevTo]);
            $days = $diffDays;
        } elseif ($request->input('days') === 'all') {
            $current = WooOrder::whereIn('status', self::PAID);
            $previous = WooOrder::whereRaw('1 = 0');
            $days = 0;
        } elseif ($request->input('days') === 'today' || (int) $request->input('days') === 1) {
            $from = now()->startOfDay();
            $to = now()->endOfDay();
            $prevFrom = now()->subDay()->startOfDay();
            $prevTo = now()->subDay()->endOfDay();

            $current = WooOrder::whereIn('status', self::PAID)->whereBetween('woo_created_at', [$from, $to]);
            $previous = WooOrder::whereIn('status', self::PAID)->whereBetween('woo_created_at', [$prevFrom, $prevTo]);
            $days = 1;
        } else {
            $days = $this->days($request);
            $now = now();
            $current = WooOrder::whereIn('status', self::PAID)->where('woo_created_at', '>=', $now->copy()->subDays($days));
            $previous = WooOrder::whereIn('status', self::PAID)->whereBetween('woo_created_at', [$now->copy()->subDays($days * 2), $now->copy()->subDays($days)]);
        }

        // Sales = processing + completed orders, minus what was refunded on them (failed, cancelled, pending and
        // on-hold orders are never counted). "Awaiting payment" are such orders WooCommerce has no payment date for
        // (e.g. cash on delivery).
        $net = DB::raw('total - refunded_total');
        $revenue = (float) $current->sum($net);
        $orders = $current->count();
        $refunded = (float) (clone $current)->sum('refunded_total');
        $unpaid = (float) (clone $current)->whereNull('woo_paid_at')->sum($net);

        return response()->json([
            'days' => $days,
            'revenue' => $revenue,
            'refunded' => round($refunded, 2),
            'paid_revenue' => round($revenue - $unpaid, 2),
            'unpaid_revenue' => round($unpaid, 2),
            'previous_revenue' => (float) $previous->sum($net),
            'orders' => $orders,
            'previous_orders' => $previous->count(),
            'average_order_value' => $orders ? round($revenue / $orders, 2) : 0,
            'awaiting_fulfilment' => WooOrder::whereIn('status', ['processing', 'on-hold', 'pending'])->count(),
            'customers' => WooCustomer::count(),
            // The store's currency from WooCommerce's own setting (read on each import), else its latest order's. null if unknown.
            'currency' => StoreCurrency::current(),
            // WooCommerce's store-wide low-stock level; null until it has been read during an import.
            'low_stock_threshold' => StockRules::globalThreshold(),
            'published_products' => WooProduct::where('status', 'publish')->count(),
            'out_of_stock_products' => WooProduct::where('status', 'publish')->where('stock_status', 'outofstock')->count(),
        ]);
    }

    #[OA\Get(
        path: '/api/v1/dashboard/revenue',
        operationId: 'dashboardRevenue',
        summary: 'Revenue and order count per day (zero-filled)',
        security: [['bearerAuth' => []]],
        tags: ['Dashboard'],
        parameters: [new OA\Parameter(name: 'days', in: 'query', schema: new OA\Schema(type: 'integer', minimum: 1, maximum: 365, default: 30))],
        responses: [
            new OA\Response(response: 200, description: 'OK', content: new OA\JsonContent(type: 'array', items: new OA\Items(properties: [
                new OA\Property(property: 'date', type: 'string', format: 'date', example: '2026-11-14'),
                new OA\Property(property: 'revenue', type: 'number', format: 'float', example: 2450),
                new OA\Property(property: 'orders', type: 'integer', example: 2),
            ]))),
            new OA\Response(response: 401, ref: '#/components/responses/Unauthenticated'),
        ],
    )]
    public function revenue(Request $request): JsonResponse
    {
        if ($request->filled('date_from')) {
            $from = Carbon::parse($request->date_from)->startOfDay();
            $to = $request->filled('date_to') ? Carbon::parse($request->date_to)->endOfDay() : now()->endOfDay();
            $days = max(1, (int) $from->diffInDays($to) + 1);
        } elseif ($request->input('days') === 'all') {
            $minDate = WooOrder::whereIn('status', self::PAID)->min('woo_created_at');
            $from = $minDate ? Carbon::parse($minDate)->startOfDay() : now()->subDays(29)->startOfDay();
            $to = now()->endOfDay();
            $days = max(1, min(365, (int) $from->diffInDays($to) + 1));
        } elseif ($request->input('days') === 'today' || (int) $request->input('days') === 1) {
            $from = now()->startOfDay();
            $to = now()->endOfDay();
            $days = 1;
        } else {
            $days = $this->days($request);
            $from = now()->subDays($days - 1)->startOfDay();
            $to = now()->endOfDay();
        }

        $rows = WooOrder::whereIn('status', self::PAID)->whereBetween('woo_created_at', [$from, $to])
            ->selectRaw('DATE(woo_created_at) as d, SUM(total - refunded_total) as revenue, COUNT(*) as orders')
            ->groupBy('d')->get()->keyBy('d');

        $out = [];
        for ($i = 0; $i < $days; $i++) {
            $date = Carbon::parse($from)->addDays($i)->toDateString();
            $out[] = [
                'date' => $date,
                'revenue' => (float) ($rows[$date]->revenue ?? 0),
                'orders' => (int) ($rows[$date]->orders ?? 0),
            ];
        }

        return response()->json($out);
    }

    #[OA\Get(
        path: '/api/v1/dashboard/orders-by-status',
        operationId: 'dashboardOrdersByStatus',
        summary: 'Order counts grouped by status (all time)',
        security: [['bearerAuth' => []]],
        tags: ['Dashboard'],
        responses: [
            new OA\Response(response: 200, description: 'OK', content: new OA\JsonContent(type: 'array', items: new OA\Items(properties: [
                new OA\Property(property: 'status', type: 'string', example: 'completed'),
                new OA\Property(property: 'count', type: 'integer', example: 11),
            ]))),
            new OA\Response(response: 401, ref: '#/components/responses/Unauthenticated'),
        ],
    )]
    public function ordersByStatus(): JsonResponse
    {
        return response()->json(
            WooOrder::selectRaw('status, COUNT(*) as count')->groupBy('status')->orderByDesc('count')->get()
        );
    }

    #[OA\Get(
        path: '/api/v1/dashboard/top-products',
        operationId: 'dashboardTopProducts',
        summary: 'Best-selling products by units sold (completed + processing orders)',
        security: [['bearerAuth' => []]],
        tags: ['Dashboard'],
        parameters: [new OA\Parameter(name: 'limit', in: 'query', schema: new OA\Schema(type: 'integer', minimum: 1, maximum: 50, default: 10))],
        responses: [
            new OA\Response(response: 200, description: 'OK', content: new OA\JsonContent(type: 'array', items: new OA\Items(properties: [
                new OA\Property(property: 'id', type: 'integer', description: 'Local product id (falls back to the WooCommerce id if the product is not in the local copy)'),
                new OA\Property(property: 'product_woo_id', type: 'integer'),
                new OA\Property(property: 'name', type: 'string'),
                new OA\Property(property: 'sku', type: 'string', nullable: true),
                new OA\Property(property: 'image_url', type: 'string', nullable: true),
                new OA\Property(property: 'units', type: 'integer'),
                new OA\Property(property: 'total_sales', type: 'integer', description: 'Same as units'),
                new OA\Property(property: 'revenue', type: 'number', format: 'float'),
            ]))),
            new OA\Response(response: 401, ref: '#/components/responses/Unauthenticated'),
        ],
    )]
    public function topProducts(Request $request): JsonResponse
    {
        $limit = max(1, min(50, (int) $request->input('limit', 10)));

        $rows = WooOrderItem::query()
            ->join('woo_orders', 'woo_orders.woo_id', '=', 'woo_order_items.order_woo_id')
            ->whereIn('woo_orders.status', self::PAID)
            ->selectRaw('woo_order_items.product_woo_id, MIN(woo_order_items.name) as name, SUM(woo_order_items.quantity) as units, SUM(woo_order_items.total) as revenue')
            ->groupBy('woo_order_items.product_woo_id')
            ->orderByDesc('units')->limit($limit)->get();

        // Local product rows give each entry its local id and image.
        $products = WooProduct::whereIn('woo_id', $rows->pluck('product_woo_id'))
            ->get(['id', 'woo_id', 'image_url', 'sku'])->keyBy('woo_id');

        return response()->json($rows->map(function ($r) use ($products) {
            $product = $products->get($r->product_woo_id);

            return [
                // `id` is the local product id (what /products/{id} uses); `total_sales` is the units sold.
                'id' => $product?->id ?? (int) $r->product_woo_id,
                'product_woo_id' => (int) $r->product_woo_id,
                'name' => $r->name,
                'sku' => $product?->sku,
                'image_url' => $product?->image_url,
                'units' => (int) $r->units,
                'total_sales' => (int) $r->units,
                'revenue' => (float) $r->revenue,
            ];
        })->values());
    }

    #[OA\Get(
        path: '/api/v1/sync/status',
        operationId: 'syncStatus',
        summary: 'Most recent import run for each resource',
        description: 'Shows how fresh the mirrored WooCommerce data is.',
        security: [['bearerAuth' => []]],
        tags: ['Sync'],
        responses: [
            new OA\Response(response: 200, description: 'OK', content: new OA\JsonContent(type: 'array', items: new OA\Items(properties: [
                new OA\Property(property: 'resource', type: 'string', example: 'orders'),
                new OA\Property(property: 'status', type: 'string', enum: ['running', 'ok', 'failed']),
                new OA\Property(property: 'records', type: 'integer'),
                new OA\Property(property: 'error', type: 'string', nullable: true),
                new OA\Property(property: 'started_at', type: 'string', format: 'date-time'),
                new OA\Property(property: 'finished_at', type: 'string', format: 'date-time', nullable: true),
            ]))),
            new OA\Response(response: 401, ref: '#/components/responses/Unauthenticated'),
        ],
    )]
    public function syncStatus(): JsonResponse
    {
        $latest = WooSyncLog::selectRaw('MAX(id) as id')->groupBy('resource');

        // The stored error text can contain internal details: only say that it failed (the log has the rest).
        return response()->json(
            WooSyncLog::whereIn('id', $latest)->orderBy('resource')->get(['resource', 'status', 'records', 'error', 'started_at', 'finished_at'])
                ->map(fn ($log) => array_merge($log->toArray(), ['error' => $log->error ? WooErrors::IMPORT_FAILED : null]))
        );
    }

    private function days(Request $request): int
    {
        return max(1, min(365, (int) $request->input('days', 30)));
    }
}
