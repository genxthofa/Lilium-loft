<?php

namespace App\Http\Controllers\Api\Write;

use App\Http\Controllers\Controller;
use App\Models\WooOrder;
use App\Services\WhatsApp\InteraktService;
use App\Services\WooCommerce\MirrorVersion;
use App\Services\WooCommerce\UpstreamUnavailable;
use App\Services\WooCommerce\WooClient;
use App\Services\WooCommerce\WooErrors;
use App\Services\WooCommerce\WooNotConfigured;
use App\Services\WooCommerce\WooSyncService;
use App\Services\WooCommerce\WooWriteClient;
use App\Services\WooCommerce\WooWriter;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;

class OrderWriteController extends Controller
{
    public const STATUSES = ['pending', 'processing', 'in-processing', 'on-hold', 'dispatch', 'out-for-delivery', 'completed', 'cancelled', 'refunded', 'failed'];

    public function __construct(
        private WooWriter $writer,
        private WooClient $woo,
        private WooSyncService $sync,
    ) {}

    #[OA\Get(
        path: '/api/v1/orders/{id}/notes',
        operationId: 'orderNotesIndex',
        summary: 'Notes on an order',
        description: 'Read live from WooCommerce (not cached), oldest first. `customer_note: true` means the customer was e-mailed the note.',
        security: [['bearerAuth' => []]],
        tags: ['Orders'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, description: 'Local order id', schema: new OA\Schema(type: 'integer'))],
        responses: [
            new OA\Response(response: 200, description: 'Notes', content: new OA\JsonContent(type: 'array', items: new OA\Items(properties: [
                new OA\Property(property: 'id', type: 'integer'),
                new OA\Property(property: 'author', type: 'string'),
                new OA\Property(property: 'date_created', type: 'string', format: 'date-time'),
                new OA\Property(property: 'note', type: 'string'),
                new OA\Property(property: 'customer_note', type: 'boolean'),
            ]))),
            new OA\Response(response: 401, ref: '#/components/responses/Unauthenticated'),
            new OA\Response(response: 404, ref: '#/components/responses/NotFound'),
            new OA\Response(response: 502, description: 'WooCommerce could not be reached', content: new OA\JsonContent(ref: '#/components/schemas/Error')),
        ],
    )]
    public function notes(int $id): JsonResponse
    {
        $order = WooOrder::findOrFail($id);
        $rows = $this->live("orders/{$order->woo_id}/notes", ['order' => 'asc']);

        return response()->json(array_map(fn (array $n) => [
            'id' => $n['id'],
            'author' => $n['author'] ?? 'system',
            'date_created' => $n['date_created_gmt'] ?? $n['date_created'] ?? null,
            'note' => $n['note'] ?? '',
            'customer_note' => (bool) ($n['customer_note'] ?? false),
        ], $rows));
    }

    #[OA\Get(
        path: '/api/v1/orders/{id}/refunds',
        operationId: 'orderRefundsIndex',
        summary: 'Refunds recorded on an order',
        description: 'Read live from WooCommerce (not cached).',
        security: [['bearerAuth' => []]],
        tags: ['Orders'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, description: 'Local order id', schema: new OA\Schema(type: 'integer'))],
        responses: [
            new OA\Response(response: 200, description: 'Refunds', content: new OA\JsonContent(type: 'array', items: new OA\Items(properties: [
                new OA\Property(property: 'id', type: 'integer'),
                new OA\Property(property: 'amount', type: 'string', example: '120.00'),
                new OA\Property(property: 'reason', type: 'string'),
                new OA\Property(property: 'date_created', type: 'string', format: 'date-time'),
            ]))),
            new OA\Response(response: 401, ref: '#/components/responses/Unauthenticated'),
            new OA\Response(response: 404, ref: '#/components/responses/NotFound'),
            new OA\Response(response: 502, description: 'WooCommerce could not be reached', content: new OA\JsonContent(ref: '#/components/schemas/Error')),
        ],
    )]
    public function refunds(int $id): JsonResponse
    {
        $order = WooOrder::findOrFail($id);
        $rows = $this->live("orders/{$order->woo_id}/refunds");

        return response()->json(array_map(fn (array $r) => [
            'id' => $r['id'],
            // WooCommerce reports refunds as negative totals; show the positive amount.
            'amount' => ltrim((string) ($r['amount'] ?? $r['total'] ?? '0'), '-'),
            'reason' => $r['reason'] ?? '',
            'date_created' => $r['date_created_gmt'] ?? $r['date_created'] ?? null,
        ], $rows));
    }

    #[OA\Put(
        path: '/api/v1/orders/{id}/status',
        operationId: 'orderStatusUpdate',
        summary: 'Change an order\'s status',
        description: 'CHANGES THE LIVE STORE. Needs the "orders.update" write switch. WooCommerce runs its normal side effects for the new status (stock changes, customer e-mails). Setting `refunded` here does NOT move money; use the refunds endpoint to record one.',
        security: [['bearerAuth' => []]],
        tags: ['Orders'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, description: 'Local order id', schema: new OA\Schema(type: 'integer'))],
        requestBody: new OA\RequestBody(required: true, content: new OA\JsonContent(required: ['status'], properties: [
            new OA\Property(property: 'status', type: 'string', enum: self::STATUSES),
        ])),
        responses: [
            new OA\Response(response: 200, description: 'Updated order with items', content: new OA\JsonContent(ref: '#/components/schemas/Order')),
            new OA\Response(response: 403, description: 'Writes are disabled or the user is not allowed to write', content: new OA\JsonContent(ref: '#/components/schemas/Error')),
            new OA\Response(response: 404, ref: '#/components/responses/NotFound'),
            new OA\Response(response: 422, description: 'Validation failed', content: new OA\JsonContent(ref: '#/components/schemas/ValidationError')),
            new OA\Response(response: 502, description: 'WooCommerce rejected the change or could not be reached', content: new OA\JsonContent(ref: '#/components/schemas/Error')),
        ],
    )]
    public function status(Request $request, int $id): JsonResponse
    {
        $order = WooOrder::findOrFail($id);
        $data = $request->validate([
            'status' => 'required|in:'.implode(',', self::STATUSES),
            'courier_name' => 'nullable|string|max:255',
            'tracking_number' => 'nullable|string|max:255',
        ]);

        $isDashboardOnlyStatus = in_array($data['status'], ['in-processing', 'dispatch', 'out-for-delivery'], true)
            || ($data['status'] === 'processing' && in_array($order->status, ['processing', 'in-processing', 'dispatch', 'out-for-delivery'], true));

        if ($isDashboardOnlyStatus) {
            // Keep WordPress on `processing`; track Order Placed / Processing / Dispatched / Out for Delivery in local DB.
            $order->update([
                'status' => $data['status'],
                'courier_name' => $data['courier_name'] ?? $order->courier_name,
                'tracking_number' => $data['tracking_number'] ?? $order->tracking_number,
                'dispatched_at' => in_array($data['status'], ['dispatch', 'out-for-delivery'], true)
                    ? ($order->dispatched_at ?? now())
                    : $order->dispatched_at,
            ]);
            MirrorVersion::bump('orders');
            $refreshed = $order->fresh()->load('items');
        } else {
            // WordPress status change (e.g. Delivered -> completed, cancelled, refunded, on-hold, pending, or processing from pending).
            $wooPayload = ['status' => $data['status']];
            $this->writer->run('orders', 'status', $order->woo_id, $wooPayload, ['status' => $order->status], $request->user(), $request->ip(),
                fn (WooWriteClient $c) => $c->put("orders/{$order->woo_id}", $wooPayload));
            $refreshed = $this->refreshed($order);
        }

        if ($data['status'] === 'processing') {
            app(InteraktService::class)->sendOrderCreated($refreshed);
        } elseif ($data['status'] === 'in-processing') {
            app(InteraktService::class)->sendOrderProcessing($refreshed);
        } elseif ($data['status'] === 'dispatch') {
            app(InteraktService::class)->sendOrderDispatched($refreshed);
        } elseif ($data['status'] === 'out-for-delivery') {
            app(InteraktService::class)->sendOrderOutForDelivery($refreshed);
        } elseif ($data['status'] === 'completed') {
            app(InteraktService::class)->sendOrderCompleted($refreshed);
        }

        return response()->json($refreshed);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $order = WooOrder::findOrFail($id);
        $data = $request->validate([
            'status' => 'sometimes|required|in:'.implode(',', self::STATUSES),
            'courier_name' => 'nullable|string|max:255',
            'tracking_number' => 'nullable|string|max:255',
            'customer_note' => 'nullable|string|max:2000',
            'payment_method' => 'nullable|string|max:100',
            'payment_method_title' => 'nullable|string|max:255',
            'transaction_id' => 'nullable|string|max:255',
            'billing' => 'sometimes|array',
            'billing.first_name' => 'nullable|string|max:100',
            'billing.last_name' => 'nullable|string|max:100',
            'billing.email' => 'nullable|email|max:255',
            'billing.phone' => 'nullable|string|max:50',
            'billing.address_1' => 'nullable|string|max:255',
            'billing.address_2' => 'nullable|string|max:255',
            'billing.city' => 'nullable|string|max:100',
            'billing.state' => 'nullable|string|max:100',
            'billing.postcode' => 'nullable|string|max:30',
            'billing.country' => 'nullable|string|max:10',
            'shipping' => 'sometimes|array',
            'shipping.first_name' => 'nullable|string|max:100',
            'shipping.last_name' => 'nullable|string|max:100',
            'shipping.phone' => 'nullable|string|max:50',
            'shipping.address_1' => 'nullable|string|max:255',
            'shipping.address_2' => 'nullable|string|max:255',
            'shipping.city' => 'nullable|string|max:100',
            'shipping.state' => 'nullable|string|max:100',
            'shipping.postcode' => 'nullable|string|max:30',
            'shipping.country' => 'nullable|string|max:10',
        ]);

        $wooPayload = [];
        $newStatus = $data['status'] ?? null;
        $isProcessingMapped = in_array($newStatus, ['in-processing', 'dispatch', 'out-for-delivery'], true);

        if ($newStatus !== null) {
            $wooPayload['status'] = $isProcessingMapped ? 'processing' : $newStatus;
        }
        foreach (['customer_note', 'payment_method', 'payment_method_title', 'transaction_id'] as $field) {
            if (array_key_exists($field, $data)) {
                $wooPayload[$field] = (string) ($data[$field] ?? '');
            }
        }
        foreach (['billing', 'shipping'] as $addrKey) {
            if (isset($data[$addrKey]) && is_array($data[$addrKey])) {
                $wooPayload[$addrKey] = array_map(
                    fn ($v) => (string) ($v ?? ''),
                    $data[$addrKey]
                );
            }
        }

        $meta = [];
        if ($isProcessingMapped) {
            $meta[] = ['key' => '_dashboard_status', 'value' => $newStatus];
            if (in_array($newStatus, ['dispatch', 'out-for-delivery'], true)) {
                $meta[] = ['key' => '_order_dispatched', 'value' => 'yes'];
            }
            if (! empty($data['courier_name'])) {
                $meta[] = ['key' => '_courier_name', 'value' => $data['courier_name']];
            }
            if (! empty($data['tracking_number'])) {
                $meta[] = ['key' => '_tracking_number', 'value' => $data['tracking_number']];
            }
        } elseif ($newStatus !== null && in_array($order->status, ['in-processing', 'dispatch', 'out-for-delivery'], true)) {
            $meta[] = ['key' => '_dashboard_status', 'value' => $newStatus];
            $meta[] = ['key' => '_order_dispatched', 'value' => $newStatus === 'completed' ? 'yes' : 'no'];
        }
        if ($meta !== []) {
            $wooPayload['meta_data'] = $meta;
        }

        $this->writer->run('orders', 'update', $order->woo_id, $wooPayload, ['status' => $order->status], $request->user(), $request->ip(),
            fn (WooWriteClient $c) => $c->put("orders/{$order->woo_id}", $wooPayload));

        if ($isProcessingMapped) {
            $order->update([
                'status' => $newStatus,
                'courier_name' => $data['courier_name'] ?? $order->courier_name,
                'tracking_number' => $data['tracking_number'] ?? $order->tracking_number,
                'dispatched_at' => in_array($newStatus, ['dispatch', 'out-for-delivery'], true)
                    ? ($order->dispatched_at ?? now())
                    : $order->dispatched_at,
            ]);
        }

        $refreshed = $this->refreshed($order);

        if (($data['status'] ?? null) === 'processing') {
            app(InteraktService::class)->sendOrderCreated($refreshed);
        } elseif (($data['status'] ?? null) === 'in-processing') {
            app(InteraktService::class)->sendOrderProcessing($refreshed);
        } elseif (($data['status'] ?? null) === 'dispatch') {
            app(InteraktService::class)->sendOrderDispatched($refreshed);
        } elseif (($data['status'] ?? null) === 'out-for-delivery') {
            app(InteraktService::class)->sendOrderOutForDelivery($refreshed);
        } elseif (($data['status'] ?? null) === 'completed') {
            app(InteraktService::class)->sendOrderCompleted($refreshed);
        }

        return response()->json($refreshed);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $order = WooOrder::findOrFail($id);

        $this->writer->run('orders', 'delete', $order->woo_id, ['force' => false], $order->attributesToArray(), $request->user(), $request->ip(),
            fn (WooWriteClient $c) => $c->delete("orders/{$order->woo_id}", false));

        $this->writer->mirror(fn () => $this->sync->forget('order', $order->woo_id));

        return response()->json(null, 204);
    }

    public function sendWhatsApp(int $id, InteraktService $interakt): JsonResponse
    {
        $order = WooOrder::with('items')->findOrFail($id);

        $sent = match ($order->status) {
            'in-processing' => $interakt->sendOrderProcessing($order),
            'dispatch' => $interakt->sendOrderDispatched($order),
            'out-for-delivery' => $interakt->sendOrderOutForDelivery($order),
            'completed' => $interakt->sendOrderCompleted($order),
            default => $interakt->sendOrderCreated($order),
        };

        return response()->json([
            'sent' => $sent,
            'configured' => $interakt->isConfigured(),
        ]);
    }

    #[OA\Post(
        path: '/api/v1/orders/{id}/notes',
        operationId: 'orderNotesCreate',
        summary: 'Add a note to an order',
        description: 'CHANGES THE LIVE STORE. Needs the "orders.note" write switch. With `customer_note: true` WooCommerce e-mails the note to the customer.',
        security: [['bearerAuth' => []]],
        tags: ['Orders'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, description: 'Local order id', schema: new OA\Schema(type: 'integer'))],
        requestBody: new OA\RequestBody(required: true, content: new OA\JsonContent(required: ['note'], properties: [
            new OA\Property(property: 'note', type: 'string'),
            new OA\Property(property: 'customer_note', type: 'boolean', default: false),
        ])),
        responses: [
            new OA\Response(response: 201, description: 'Created note'),
            new OA\Response(response: 403, description: 'Writes are disabled or the user is not allowed to write', content: new OA\JsonContent(ref: '#/components/schemas/Error')),
            new OA\Response(response: 404, ref: '#/components/responses/NotFound'),
            new OA\Response(response: 422, description: 'Validation failed', content: new OA\JsonContent(ref: '#/components/schemas/ValidationError')),
            new OA\Response(response: 502, description: 'WooCommerce rejected the change or could not be reached', content: new OA\JsonContent(ref: '#/components/schemas/Error')),
        ],
    )]
    public function addNote(Request $request, int $id): JsonResponse
    {
        $order = WooOrder::findOrFail($id);
        $data = $request->validate([
            'note' => 'required|string|max:5000',
            'customer_note' => 'sometimes|boolean',
        ]);
        $data += ['customer_note' => false];

        $note = $this->writer->run('orders', 'note', $order->woo_id, $data, null, $request->user(), $request->ip(),
            fn (WooWriteClient $c) => $c->post("orders/{$order->woo_id}/notes", $data));

        return response()->json([
            'id' => $note['id'] ?? null,
            'author' => $note['author'] ?? 'system',
            'date_created' => $note['date_created_gmt'] ?? $note['date_created'] ?? null,
            'note' => $note['note'] ?? $data['note'],
            'customer_note' => (bool) ($note['customer_note'] ?? $data['customer_note']),
        ], 201);
    }

    #[OA\Post(
        path: '/api/v1/orders/{id}/refunds',
        operationId: 'orderRefundsCreate',
        summary: 'Record a refund on an order',
        description: 'CHANGES THE LIVE STORE. Needs the "orders.refund" write switch. This only RECORDS the refund in WooCommerce; it never asks the payment gateway to send money back (`api_refund` is always false), so the money must be returned through the gateway separately. The amount must be greater than zero and WooCommerce rejects anything above what is still refundable.',
        security: [['bearerAuth' => []]],
        tags: ['Orders'],
        parameters: [new OA\Parameter(name: 'id', in: 'path', required: true, description: 'Local order id', schema: new OA\Schema(type: 'integer'))],
        requestBody: new OA\RequestBody(required: true, content: new OA\JsonContent(required: ['amount'], properties: [
            new OA\Property(property: 'amount', type: 'string', example: '120.00'),
            new OA\Property(property: 'reason', type: 'string'),
        ])),
        responses: [
            new OA\Response(response: 201, description: 'Created refund'),
            new OA\Response(response: 403, description: 'Writes are disabled or the user is not allowed to write', content: new OA\JsonContent(ref: '#/components/schemas/Error')),
            new OA\Response(response: 404, ref: '#/components/responses/NotFound'),
            new OA\Response(response: 422, description: 'Validation failed', content: new OA\JsonContent(ref: '#/components/schemas/ValidationError')),
            new OA\Response(response: 502, description: 'WooCommerce rejected the change or could not be reached', content: new OA\JsonContent(ref: '#/components/schemas/Error')),
        ],
    )]
    public function addRefund(Request $request, int $id): JsonResponse
    {
        $order = WooOrder::findOrFail($id);
        $data = $request->validate([
            'amount' => 'required|numeric|gt:0|max:99999999',
            'reason' => 'sometimes|nullable|string|max:1000',
        ]);

        if ((float) $data['amount'] > (float) $order->total) {
            abort(422, 'The refund cannot be more than the order total.');
        }

        // api_refund is hard-wired to false: recording a refund must never move real money.
        $payload = ['amount' => (string) $data['amount'], 'reason' => (string) ($data['reason'] ?? ''), 'api_refund' => false];

        $refund = $this->writer->run('orders', 'refund', $order->woo_id, $payload, ['total' => $order->total, 'status' => $order->status], $request->user(), $request->ip(),
            fn (WooWriteClient $c) => $c->post("orders/{$order->woo_id}/refunds", $payload));

        $this->refreshed($order);

        return response()->json([
            'id' => $refund['id'] ?? null,
            'amount' => ltrim((string) ($refund['amount'] ?? $payload['amount']), '-'),
            'reason' => $refund['reason'] ?? $payload['reason'],
            'date_created' => $refund['date_created_gmt'] ?? $refund['date_created'] ?? null,
        ], 201);
    }

    /** Re-read the order from WooCommerce (it may have changed status or totals) and update the mirror. */
    private function refreshed(WooOrder $order): WooOrder
    {
        try {
            return $this->sync->storeOrder($this->woo->get("orders/{$order->woo_id}"))->load('items');
        } catch (\Throwable $e) {
            report($e);

            return $order->refresh()->load('items');
        }
    }

    /** @return array<int, array<string, mixed>> */
    private function live(string $endpoint, array $query = []): array
    {
        try {
            return $this->woo->get($endpoint, $query);
        } catch (RequestException|ConnectionException|WooNotConfigured $e) {
            throw new UpstreamUnavailable(WooErrors::describe($e, "read {$endpoint}"));
        }
    }
}
