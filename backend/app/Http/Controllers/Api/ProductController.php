<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WooOrderItem;
use App\Models\WooProduct;
use App\Services\WooCommerce\ProductWriteService;
use App\Services\WooCommerce\WriteFailed;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use OpenApi\Attributes as OA;

class ProductController extends Controller
{
    #[OA\Get(
        path: '/api/v1/products',
        operationId: 'productsIndex',
        summary: 'List products',
        security: [['bearerAuth' => []]],
        tags: ['Products'],
        parameters: [
            new OA\Parameter(ref: '#/components/parameters/page'),
            new OA\Parameter(ref: '#/components/parameters/per_page'),
            new OA\Parameter(name: 'search', in: 'query', description: 'Matches name or SKU', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'status', in: 'query', description: 'e.g. publish, draft, private', schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'stock_status', in: 'query', schema: new OA\Schema(type: 'string', enum: ['instock', 'outofstock', 'onbackorder'])),
            new OA\Parameter(name: 'category_id', in: 'query', description: 'WooCommerce category id (woo_id)', schema: new OA\Schema(type: 'integer')),
            new OA\Parameter(name: 'sort', in: 'query', schema: new OA\Schema(type: 'string', enum: ['woo_modified_at', 'name', 'price', 'total_sales', 'stock_quantity'], default: 'woo_modified_at')),
            new OA\Parameter(name: 'direction', in: 'query', schema: new OA\Schema(type: 'string', enum: ['asc', 'desc'], default: 'desc')),
        ],
        responses: [
            new OA\Response(response: 200, description: 'Paginated products', content: new OA\JsonContent(allOf: [
                new OA\Schema(ref: '#/components/schemas/PaginationEnvelope'),
                new OA\Schema(properties: [new OA\Property(property: 'data', type: 'array', items: new OA\Items(ref: '#/components/schemas/Product'))]),
            ])),
            new OA\Response(response: 401, ref: '#/components/responses/Unauthenticated'),
        ],
    )]
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'per_page' => 'integer|min:1|max:100',
            'category_id' => 'integer',
            'sort' => 'in:woo_modified_at,name,price,total_sales,stock_quantity',
            'direction' => 'in:asc,desc',
        ]);

        $q = WooProduct::query()->with('categories')
            ->when($request->status, fn ($q, $v) => $q->where('status', $v))
            ->when($request->stock_status, fn ($q, $v) => $q->where('stock_status', $v))
            ->when($request->category_id, fn ($q, $v) => $q->whereHas('categories', fn ($c) => $c->where('woo_categories.woo_id', $v)))
            ->when($request->search, fn ($q, $v) => $q->where(fn ($w) => $w->where('name', 'like', "%{$v}%")->orWhere('sku', 'like', "%{$v}%")))
            ->orderBy($request->input('sort', 'woo_modified_at'), $request->input('direction', 'desc'));

        $page = $q->paginate((int) $request->input('per_page', 20))->withQueryString();
        $page->getCollection()->each->append(WooProduct::DETAIL_ATTRS);
        $this->addRevenue($page->getCollection());

        return response()->json($page);
    }

    #[OA\Get(
        path: '/api/v1/products/{id}',
        operationId: 'productsShow',
        summary: 'Product detail',
        security: [['bearerAuth' => []]],
        tags: ['Products'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, description: 'Local product id', schema: new OA\Schema(type: 'integer'))],
        responses: [
            new OA\Response(response: 200, description: 'OK', content: new OA\JsonContent(ref: '#/components/schemas/Product')),
            new OA\Response(response: 401, ref: '#/components/responses/Unauthenticated'),
            new OA\Response(response: 404, ref: '#/components/responses/NotFound'),
        ],
    )]
    public function show(int $id): JsonResponse
    {
        $product = WooProduct::with('categories')->findOrFail($id)->append(WooProduct::DETAIL_ATTRS);
        $this->addRevenue(collect([$product]));

        return response()->json($product);
    }

    #[OA\Put(
        path: '/api/v1/products/{id}',
        operationId: 'productsUpdatePut',
        summary: 'Update product price and stock',
        description: 'CHANGES THE LIVE STORE. Sends the change to WooCommerce, then refreshes the local copy from its response. Only available when writes are enabled (the master switch, the "products.update" switch, and a user with write permission, all under Settings → Store changes); otherwise returns 403 and nothing is sent. Send only the fields to change; set `sale_price` to an empty string to remove a sale price.',
        security: [['bearerAuth' => []]],
        tags: ['Products'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, description: 'Local product id', schema: new OA\Schema(type: 'integer'))],
        requestBody: new OA\RequestBody(required: true, content: new OA\JsonContent(
            properties: [
                new OA\Property(property: 'regular_price', type: 'string', example: '499.00'),
                new OA\Property(property: 'sale_price', type: 'string', nullable: true, example: '449.00'),
                new OA\Property(property: 'manage_stock', type: 'boolean', example: true),
                new OA\Property(property: 'stock_quantity', type: 'integer', nullable: true, example: 12),
                new OA\Property(property: 'stock_status', type: 'string', enum: ['instock', 'outofstock', 'onbackorder']),
            ],
        )),
        responses: [
            new OA\Response(response: 200, description: 'Updated product', content: new OA\JsonContent(ref: '#/components/schemas/Product')),
            new OA\Response(response: 401, ref: '#/components/responses/Unauthenticated'),
            new OA\Response(response: 403, description: 'Writes are disabled or the user is not allowed to write', content: new OA\JsonContent(ref: '#/components/schemas/Error')),
            new OA\Response(response: 404, ref: '#/components/responses/NotFound'),
            new OA\Response(response: 422, description: 'Validation failed', content: new OA\JsonContent(ref: '#/components/schemas/ValidationError')),
            new OA\Response(response: 502, description: 'WooCommerce rejected the change or could not be reached', content: new OA\JsonContent(ref: '#/components/schemas/Error')),
        ],
    )]
    #[OA\Patch(
        path: '/api/v1/products/{id}',
        operationId: 'productsUpdatePatch',
        summary: 'Update product price and stock (partial)',
        description: 'Same behaviour as PUT. Both are partial updates; only the fields sent are changed.',
        security: [['bearerAuth' => []]],
        tags: ['Products'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, description: 'Local product id', schema: new OA\Schema(type: 'integer'))],
        requestBody: new OA\RequestBody(required: true, content: new OA\JsonContent(
            properties: [
                new OA\Property(property: 'regular_price', type: 'string', example: '499.00'),
                new OA\Property(property: 'sale_price', type: 'string', nullable: true, example: '449.00'),
                new OA\Property(property: 'manage_stock', type: 'boolean', example: true),
                new OA\Property(property: 'stock_quantity', type: 'integer', nullable: true, example: 12),
                new OA\Property(property: 'stock_status', type: 'string', enum: ['instock', 'outofstock', 'onbackorder']),
            ],
        )),
        responses: [
            new OA\Response(response: 200, description: 'Updated product', content: new OA\JsonContent(ref: '#/components/schemas/Product')),
            new OA\Response(response: 401, ref: '#/components/responses/Unauthenticated'),
            new OA\Response(response: 403, description: 'Writes are disabled or the user is not allowed to write', content: new OA\JsonContent(ref: '#/components/schemas/Error')),
            new OA\Response(response: 404, ref: '#/components/responses/NotFound'),
            new OA\Response(response: 422, description: 'Validation failed', content: new OA\JsonContent(ref: '#/components/schemas/ValidationError')),
            new OA\Response(response: 502, description: 'WooCommerce rejected the change or could not be reached', content: new OA\JsonContent(ref: '#/components/schemas/Error')),
        ],
    )]
    public function update(Request $request, int $id, ProductWriteService $writer): JsonResponse
    {
        $product = WooProduct::findOrFail($id);

        $data = $request->validate([
            'regular_price' => 'sometimes|numeric|min:0|max:99999999',
            'sale_price' => 'sometimes|nullable|numeric|min:0|max:99999999',
            'manage_stock' => 'sometimes|boolean',
            'stock_quantity' => 'sometimes|nullable|integer|min:0|max:1000000',
            'stock_status' => 'sometimes|in:instock,outofstock,onbackorder',
            'name' => 'sometimes|string|max:255',
            'slug' => 'sometimes|string|max:200|regex:/^[a-z0-9-]+$/',
            'sku' => 'sometimes|nullable|string|max:100',
            'status' => 'sometimes|in:publish,draft,pending,private',
            'description' => 'sometimes|nullable|string|max:65000',
            'short_description' => 'sometimes|nullable|string|max:5000',
            'featured' => 'sometimes|boolean',
            'categories' => 'sometimes|array|max:50',
            'categories.*' => 'integer|exists:woo_categories,woo_id',
            'images' => 'sometimes|array|max:10',
            'images.*' => 'url|max:2000',
        ]);

        if (isset($data['categories'])) {
            $data['categories'] = array_map(fn ($id) => ['id' => (int) $id], $data['categories']);
        }
        if (isset($data['images'])) {
            $data['images'] = array_map(fn ($src) => ['src' => $src], $data['images']);
        }

        if ($data === []) {
            throw ValidationException::withMessages(['body' => 'Send at least one field to change.']);
        }

        // Variable/grouped products keep their prices on the variations, which this endpoint does not touch.
        if ($product->type !== 'simple' && (array_key_exists('regular_price', $data) || array_key_exists('sale_price', $data))) {
            throw ValidationException::withMessages(['regular_price' => "Prices can only be changed on simple products (this one is '{$product->type}')."]);
        }

        // A sale price must not exceed the regular price that will be in effect.
        $regular = $data['regular_price'] ?? $product->regular_price;
        if (($data['sale_price'] ?? null) !== null && $regular !== null && (float) $data['sale_price'] > (float) $regular) {
            throw ValidationException::withMessages(['sale_price' => 'The sale price cannot be higher than the regular price.']);
        }

        // WooCommerce expects prices as strings; null clears a sale price.
        foreach (['regular_price', 'sale_price'] as $field) {
            if (array_key_exists($field, $data)) {
                $data[$field] = $data[$field] === null ? '' : (string) $data[$field];
            }
        }

        try {
            $updated = $writer->update($product, $data, $request->user(), $request->ip());
        } catch (WriteFailed $e) {
            return response()->json(['message' => $e->getMessage()], 502);
        }

        return response()->json($updated->load('categories'));
    }

    /**
     * Lifetime revenue per product: the line totals of completed and processing orders in the local copy.
     * (WooCommerce already supplies the units sold as `total_sales`.)
     *
     * @param  \Illuminate\Support\Collection<int, WooProduct>  $products
     */
    private function addRevenue($products): void
    {
        $revenue = WooOrderItem::query()
            ->join('woo_orders', 'woo_orders.woo_id', '=', 'woo_order_items.order_woo_id')
            ->whereIn('woo_orders.status', ['completed', 'processing', 'in-processing', 'dispatch', 'out-for-delivery'])
            ->whereIn('woo_order_items.product_woo_id', $products->pluck('woo_id'))
            ->selectRaw('woo_order_items.product_woo_id as woo_id, SUM(woo_order_items.total) as revenue')
            ->groupBy('woo_order_items.product_woo_id')
            ->pluck('revenue', 'woo_id');

        $products->each(fn (WooProduct $p) => $p->setAttribute('revenue', (float) ($revenue[$p->woo_id] ?? 0)));
    }
}
