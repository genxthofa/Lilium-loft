<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WooOrder;
use App\Models\WooOrderItem;
use App\Models\WooProduct;
use App\Services\WooCommerce\StockRules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\ValidationException;
use OpenApi\Attributes as OA;

/**
 * Reports are computed from the local mirror (no WooCommerce calls).
 * "Sales" means orders with status completed or processing, like the dashboard.
 * Dates are stored and grouped in UTC.
 */
class ReportController extends Controller
{
    private const PAID = ['completed', 'processing', 'dispatch'];

    #[OA\Get(
        path: '/api/v1/reports/sales',
        operationId: 'reportsSales',
        summary: 'Sales over time',
        description: 'Orders, gross sales, discounts, shipping and tax per day, week (Monday start) or month, zero-filled, plus totals. `net_sales` = gross - shipping - tax.',
        security: [['bearerAuth' => []]],
        tags: ['Reports'],
        parameters: [
            new OA\Parameter(ref: '#/components/parameters/report_from'),
            new OA\Parameter(ref: '#/components/parameters/report_to'),
            new OA\Parameter(name: 'group_by', in: 'query', schema: new OA\Schema(type: 'string', enum: ['day', 'week', 'month'], default: 'day')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'OK', content: new OA\JsonContent(properties: [
                new OA\Property(property: 'from', type: 'string', format: 'date'),
                new OA\Property(property: 'to', type: 'string', format: 'date'),
                new OA\Property(property: 'group_by', type: 'string'),
                new OA\Property(property: 'totals', type: 'object', properties: [
                    new OA\Property(property: 'orders', type: 'integer'),
                    new OA\Property(property: 'items_sold', type: 'integer'),
                    new OA\Property(property: 'gross_sales', type: 'number', format: 'float'),
                    new OA\Property(property: 'refunds', type: 'number', format: 'float'),
                    new OA\Property(property: 'discounts', type: 'number', format: 'float'),
                    new OA\Property(property: 'shipping', type: 'number', format: 'float'),
                    new OA\Property(property: 'tax', type: 'number', format: 'float'),
                    new OA\Property(property: 'net_sales', type: 'number', format: 'float'),
                    new OA\Property(property: 'average_order_value', type: 'number', format: 'float'),
                ]),
                new OA\Property(property: 'data', type: 'array', items: new OA\Items(properties: [
                    new OA\Property(property: 'period', type: 'string', format: 'date', description: 'First day of the day/week/month'),
                    new OA\Property(property: 'orders', type: 'integer'),
                    new OA\Property(property: 'gross_sales', type: 'number', format: 'float'),
                    new OA\Property(property: 'discounts', type: 'number', format: 'float'),
                    new OA\Property(property: 'shipping', type: 'number', format: 'float'),
                    new OA\Property(property: 'tax', type: 'number', format: 'float'),
                    new OA\Property(property: 'net_sales', type: 'number', format: 'float'),
                ])),
            ])),
            new OA\Response(response: 401, ref: '#/components/responses/Unauthenticated'),
            new OA\Response(response: 422, description: 'Validation failed', content: new OA\JsonContent(ref: '#/components/schemas/ValidationError')),
        ],
    )]
    public function sales(Request $request): JsonResponse
    {
        [$from, $to] = $this->range($request);
        $request->validate(['group_by' => 'in:day,week,month']);
        $groupBy = $request->input('group_by', 'day');

        $period = match ($groupBy) {
            'day' => 'DATE(woo_created_at)',
            'week' => 'DATE_SUB(DATE(woo_created_at), INTERVAL WEEKDAY(woo_created_at) DAY)',
            'month' => "DATE_FORMAT(woo_created_at, '%Y-%m-01')",
        };

        $rows = $this->orders($from, $to)
            ->selectRaw("{$period} as period, COUNT(*) as orders, SUM(total) as gross, SUM(refunded_total) as refund_sum, SUM(discount_total) as discount_sum, SUM(shipping_total) as ship_sum, SUM(total_tax) as tax_sum")
            ->groupBy('period')->get()->keyBy('period');

        $cursor = match ($groupBy) {
            'day' => $from->copy()->startOfDay(),
            'week' => $from->copy()->startOfWeek(Carbon::MONDAY),
            'month' => $from->copy()->startOfMonth(),
        };

        $data = [];
        $totals = ['orders' => 0, 'gross_sales' => 0.0, 'refunds' => 0.0, 'discounts' => 0.0, 'shipping' => 0.0, 'tax' => 0.0];
        while ($cursor->lte($to)) {
            $key = $cursor->toDateString();
            $r = $rows[$key] ?? null;
            $gross = (float) ($r->gross ?? 0);
            // NOTE: these aliases must not match an attribute of the order model (it has `shipping` and `billing`
            // address accessors), or the model would return the address instead of the summed amount.
            $refunds = (float) ($r->refund_sum ?? 0);
            $ship = (float) ($r->ship_sum ?? 0);
            $tax = (float) ($r->tax_sum ?? 0);
            $data[] = [
                'period' => $key,
                'orders' => (int) ($r->orders ?? 0),
                'gross_sales' => $gross,
                'refunds' => $refunds,
                'discounts' => (float) ($r->discount_sum ?? 0),
                'shipping' => $ship,
                'tax' => $tax,
                'net_sales' => round($gross - $refunds - $ship - $tax, 2),
            ];
            $totals['orders'] += (int) ($r->orders ?? 0);
            $totals['gross_sales'] += $gross;
            $totals['refunds'] += $refunds;
            $totals['discounts'] += (float) ($r->discount_sum ?? 0);
            $totals['shipping'] += $ship;
            $totals['tax'] += $tax;

            match ($groupBy) {
                'day' => $cursor->addDay(),
                'week' => $cursor->addWeek(),
                'month' => $cursor->addMonthNoOverflow(),
            };
        }

        $totals['items_sold'] = (int) WooOrderItem::query()
            ->join('woo_orders', 'woo_orders.woo_id', '=', 'woo_order_items.order_woo_id')
            ->whereIn('woo_orders.status', self::PAID)
            ->whereBetween('woo_orders.woo_created_at', [$from, $to])
            ->sum('woo_order_items.quantity');
        $totals['net_sales'] = round($totals['gross_sales'] - $totals['refunds'] - $totals['shipping'] - $totals['tax'], 2);
        // Average order value is what customers actually kept paying for: after refunds.
        $totals['average_order_value'] = $totals['orders'] ? round(($totals['gross_sales'] - $totals['refunds']) / $totals['orders'], 2) : 0;

        return response()->json([
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'group_by' => $groupBy,
            'totals' => $totals,
            'data' => $data,
        ]);
    }

    #[OA\Get(
        path: '/api/v1/reports/products',
        operationId: 'reportsProducts',
        summary: 'Product performance',
        security: [['bearerAuth' => []]],
        tags: ['Reports'],
        parameters: [
            new OA\Parameter(ref: '#/components/parameters/report_from'),
            new OA\Parameter(ref: '#/components/parameters/report_to'),
            new OA\Parameter(name: 'sort', in: 'query', schema: new OA\Schema(type: 'string', enum: ['units', 'revenue'], default: 'revenue')),
            new OA\Parameter(name: 'limit', in: 'query', schema: new OA\Schema(type: 'integer', minimum: 1, maximum: 100, default: 20)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'OK', content: new OA\JsonContent(type: 'array', items: new OA\Items(properties: [
                new OA\Property(property: 'product_woo_id', type: 'integer'),
                new OA\Property(property: 'name', type: 'string'),
                new OA\Property(property: 'orders', type: 'integer'),
                new OA\Property(property: 'units', type: 'integer'),
                new OA\Property(property: 'revenue', type: 'number', format: 'float'),
            ]))),
            new OA\Response(response: 401, ref: '#/components/responses/Unauthenticated'),
            new OA\Response(response: 422, description: 'Validation failed', content: new OA\JsonContent(ref: '#/components/schemas/ValidationError')),
        ],
    )]
    public function products(Request $request): JsonResponse
    {
        [$from, $to] = $this->range($request);
        $request->validate(['sort' => 'in:units,revenue', 'limit' => 'integer|min:1|max:100']);

        $rows = $this->items($from, $to)
            ->selectRaw('woo_order_items.product_woo_id, MIN(woo_order_items.name) as name, COUNT(DISTINCT woo_orders.woo_id) as orders, SUM(woo_order_items.quantity) as units, SUM(woo_order_items.total) as revenue')
            ->groupBy('woo_order_items.product_woo_id')
            ->orderByDesc($request->input('sort', 'revenue'))
            ->limit((int) $request->input('limit', 20))->get()
            ->map(fn ($r) => [
                'product_woo_id' => (int) $r->product_woo_id,
                'name' => $r->name,
                'orders' => (int) $r->orders,
                'units' => (int) $r->units,
                'revenue' => (float) $r->revenue,
            ]);

        return response()->json($rows);
    }

    #[OA\Get(
        path: '/api/v1/reports/categories',
        operationId: 'reportsCategories',
        summary: 'Sales by product category',
        description: 'A product that belongs to several categories is counted in each of them, so category figures can add up to more than total sales.',
        security: [['bearerAuth' => []]],
        tags: ['Reports'],
        parameters: [
            new OA\Parameter(ref: '#/components/parameters/report_from'),
            new OA\Parameter(ref: '#/components/parameters/report_to'),
        ],
        responses: [
            new OA\Response(response: 200, description: 'OK', content: new OA\JsonContent(type: 'array', items: new OA\Items(properties: [
                new OA\Property(property: 'category_woo_id', type: 'integer'),
                new OA\Property(property: 'name', type: 'string'),
                new OA\Property(property: 'orders', type: 'integer'),
                new OA\Property(property: 'units', type: 'integer'),
                new OA\Property(property: 'revenue', type: 'number', format: 'float'),
            ]))),
            new OA\Response(response: 401, ref: '#/components/responses/Unauthenticated'),
            new OA\Response(response: 422, description: 'Validation failed', content: new OA\JsonContent(ref: '#/components/schemas/ValidationError')),
        ],
    )]
    public function categories(Request $request): JsonResponse
    {
        [$from, $to] = $this->range($request);

        $rows = $this->items($from, $to)
            ->join('woo_category_product as cp', 'cp.product_woo_id', '=', 'woo_order_items.product_woo_id')
            ->join('woo_categories as c', 'c.woo_id', '=', 'cp.category_woo_id')
            ->selectRaw('c.woo_id as category_woo_id, c.name, COUNT(DISTINCT woo_orders.woo_id) as orders, SUM(woo_order_items.quantity) as units, SUM(woo_order_items.total) as revenue')
            ->groupBy('c.woo_id', 'c.name')
            ->orderByDesc('revenue')->get()
            ->map(fn ($r) => [
                'category_woo_id' => (int) $r->category_woo_id,
                'name' => $r->name,
                'orders' => (int) $r->orders,
                'units' => (int) $r->units,
                'revenue' => (float) $r->revenue,
            ]);

        return response()->json($rows);
    }

    #[OA\Get(
        path: '/api/v1/reports/customers',
        operationId: 'reportsCustomers',
        summary: 'Top customers by spend',
        description: 'Grouped by billing email, so guest checkouts are included.',
        security: [['bearerAuth' => []]],
        tags: ['Reports'],
        parameters: [
            new OA\Parameter(ref: '#/components/parameters/report_from'),
            new OA\Parameter(ref: '#/components/parameters/report_to'),
            new OA\Parameter(name: 'limit', in: 'query', schema: new OA\Schema(type: 'integer', minimum: 1, maximum: 100, default: 20)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'OK', content: new OA\JsonContent(type: 'array', items: new OA\Items(properties: [
                new OA\Property(property: 'email', type: 'string'),
                new OA\Property(property: 'name', type: 'string', nullable: true),
                new OA\Property(property: 'orders', type: 'integer'),
                new OA\Property(property: 'total_spent', type: 'number', format: 'float'),
                new OA\Property(property: 'last_order_at', type: 'string', format: 'date-time'),
            ]))),
            new OA\Response(response: 401, ref: '#/components/responses/Unauthenticated'),
            new OA\Response(response: 422, description: 'Validation failed', content: new OA\JsonContent(ref: '#/components/schemas/ValidationError')),
        ],
    )]
    public function customers(Request $request): JsonResponse
    {
        [$from, $to] = $this->range($request);
        $request->validate(['limit' => 'integer|min:1|max:100']);

        $rows = $this->orders($from, $to)->whereNotNull('billing_email')
            ->selectRaw('billing_email, MIN(billing_name) as name, COUNT(*) as orders, SUM(total - refunded_total) as total_spent, MAX(woo_created_at) as last_order_at')
            ->groupBy('billing_email')->orderByDesc('total_spent')
            ->limit((int) $request->input('limit', 20))->get()
            ->map(fn ($r) => [
                'email' => $r->billing_email,
                'name' => $r->name,
                'orders' => (int) $r->orders,
                'total_spent' => (float) $r->total_spent,
                'last_order_at' => Carbon::parse($r->last_order_at)->toIso8601String(),
            ]);

        return response()->json($rows);
    }

    #[OA\Get(
        path: '/api/v1/reports/coupons',
        operationId: 'reportsCoupons',
        summary: 'Coupon usage',
        description: 'Orders that used each coupon. When an order used several coupons, its full discount is shown against each, so `discount_total` is an upper bound per coupon.',
        security: [['bearerAuth' => []]],
        tags: ['Reports'],
        parameters: [
            new OA\Parameter(ref: '#/components/parameters/report_from'),
            new OA\Parameter(ref: '#/components/parameters/report_to'),
        ],
        responses: [
            new OA\Response(response: 200, description: 'OK', content: new OA\JsonContent(type: 'array', items: new OA\Items(properties: [
                new OA\Property(property: 'code', type: 'string'),
                new OA\Property(property: 'uses', type: 'integer'),
                new OA\Property(property: 'order_total', type: 'number', format: 'float', description: 'Sum of the totals of orders that used the coupon'),
                new OA\Property(property: 'discount_total', type: 'number', format: 'float'),
            ]))),
            new OA\Response(response: 401, ref: '#/components/responses/Unauthenticated'),
            new OA\Response(response: 422, description: 'Validation failed', content: new OA\JsonContent(ref: '#/components/schemas/ValidationError')),
        ],
    )]
    public function coupons(Request $request): JsonResponse
    {
        [$from, $to] = $this->range($request);

        $byCode = [];
        foreach ($this->orders($from, $to)->whereNotNull('coupon_codes')->select(['coupon_codes', 'total', 'discount_total'])->cursor() as $o) {
            foreach ((array) $o->coupon_codes as $code) {
                $byCode[$code] ??= ['code' => $code, 'uses' => 0, 'order_total' => 0.0, 'discount_total' => 0.0];
                $byCode[$code]['uses']++;
                $byCode[$code]['order_total'] += (float) $o->total;
                $byCode[$code]['discount_total'] += (float) $o->discount_total;
            }
        }

        $rows = collect($byCode)->map(fn ($r) => [
            'code' => $r['code'],
            'uses' => $r['uses'],
            'order_total' => round($r['order_total'], 2),
            'discount_total' => round($r['discount_total'], 2),
        ])->sortByDesc('uses')->values();

        return response()->json($rows);
    }

    #[OA\Get(
        path: '/api/v1/reports/stock',
        operationId: 'reportsStock',
        summary: 'Current stock position',
        description: 'A snapshot of published products right now (no date range).',
        security: [['bearerAuth' => []]],
        tags: ['Reports'],
        parameters: [
            new OA\Parameter(name: 'limit', in: 'query', description: 'Maximum rows in each list', schema: new OA\Schema(type: 'integer', minimum: 1, maximum: 200, default: 100)),
        ],
        responses: [
            new OA\Response(response: 200, description: 'OK', content: new OA\JsonContent(properties: [
                new OA\Property(property: 'threshold', type: 'integer', nullable: true, description: 'The store-wide low-stock level from WooCommerce; null until it has been read during an import. Products can also have their own level.'),
                new OA\Property(property: 'out_of_stock_count', type: 'integer'),
                new OA\Property(property: 'low_stock_count', type: 'integer'),
                new OA\Property(property: 'out_of_stock', type: 'array', items: new OA\Items(type: 'object')),
                new OA\Property(property: 'low_stock', type: 'array', items: new OA\Items(type: 'object')),
            ])),
            new OA\Response(response: 401, ref: '#/components/responses/Unauthenticated'),
            new OA\Response(response: 422, description: 'Validation failed', content: new OA\JsonContent(ref: '#/components/schemas/ValidationError')),
        ],
    )]
    public function stock(Request $request): JsonResponse
    {
        $request->validate(['limit' => 'integer|min:1|max:200']);
        $limit = (int) $request->input('limit', 100);
        $fields = ['id', 'woo_id', 'name', 'sku', 'stock_quantity', 'stock_status'];

        $out = WooProduct::where('status', 'publish')->where('stock_status', 'outofstock');
        // "Low" follows WooCommerce's own rule (the product's level, else the store-wide one); see StockRules.
        $low = StockRules::lowStockProducts();

        return response()->json([
            'threshold' => StockRules::globalThreshold(),
            'out_of_stock_count' => (clone $out)->count(),
            'low_stock_count' => $low->count(),
            'out_of_stock' => $out->orderBy('name')->limit($limit)->get($fields),
            'low_stock' => $low->sortBy('stock_quantity')->take($limit)->map(fn ($p) => $p->only($fields))->values(),
        ]);
    }

    /** @return array{0: Carbon, 1: Carbon} */
    private function range(Request $request): array
    {
        $request->validate(['from' => 'date', 'to' => 'date|after_or_equal:from']);

        $to = $request->filled('to') ? Carbon::parse($request->input('to'))->endOfDay() : now()->endOfDay();
        $from = $request->filled('from') ? Carbon::parse($request->input('from'))->startOfDay() : $to->copy()->subDays(29)->startOfDay();

        if ($from->diffInDays($to) > 366) {
            throw ValidationException::withMessages(['from' => 'The date range cannot be longer than 366 days.']);
        }

        return [$from, $to];
    }

    /** Paid orders in the range. */
    private function orders(Carbon $from, Carbon $to)
    {
        return WooOrder::whereIn('status', self::PAID)->whereBetween('woo_created_at', [$from, $to]);
    }

    /** Line items of paid orders in the range, joined to their order. */
    private function items(Carbon $from, Carbon $to)
    {
        return WooOrderItem::query()
            ->join('woo_orders', 'woo_orders.woo_id', '=', 'woo_order_items.order_woo_id')
            ->whereIn('woo_orders.status', self::PAID)
            ->whereBetween('woo_orders.woo_created_at', [$from, $to]);
    }
}
