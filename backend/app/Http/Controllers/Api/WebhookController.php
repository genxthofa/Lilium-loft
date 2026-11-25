<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\ProcessWooWebhook;
use App\Models\WooWebhookDelivery;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenApi\Attributes as OA;
use Throwable;

/**
 * Receives webhooks FROM WooCommerce. Public (no JWT) but every call must carry a valid
 * HMAC signature made with WOO_WEBHOOK_SECRET. It only queues work for the local mirror.
 */
class WebhookController extends Controller
{
    /** WooCommerce webhook resources we mirror. */
    private const RESOURCES = ['order', 'product', 'customer', 'coupon'];

    #[OA\Post(
        path: '/api/webhooks/woocommerce',
        operationId: 'webhooksWoocommerce',
        summary: 'Receive a WooCommerce webhook',
        description: "Called by WooCommerce, not by the frontend. Not protected by JWT: instead the `X-WC-Webhook-Signature` header (base64 HMAC-SHA256 of the raw body, keyed with the webhook secret) must be valid, otherwise the request is rejected with 401 and nothing is stored.\n\nA valid delivery is logged, queued and answered with 200 immediately; the local mirror is updated by the queue worker. Supported topics: `order.*`, `product.*`, `customer.*`, `coupon.*` (created, updated, deleted, restored). Create the webhooks with delivery API version **v3**.",
        security: [],
        tags: ['Webhooks'],
        parameters: [
            new OA\Parameter(name: 'X-WC-Webhook-Signature', in: 'header', required: true, schema: new OA\Schema(type: 'string')),
            new OA\Parameter(name: 'X-WC-Webhook-Topic', in: 'header', required: true, schema: new OA\Schema(type: 'string', example: 'order.updated')),
            new OA\Parameter(name: 'X-WC-Webhook-Delivery-ID', in: 'header', schema: new OA\Schema(type: 'string')),
        ],
        requestBody: new OA\RequestBody(required: true, content: new OA\JsonContent(type: 'object', description: 'The WooCommerce REST v3 representation of the record')),
        responses: [
            new OA\Response(response: 200, description: 'Accepted (queued), duplicate, ignored topic, or ping', content: new OA\JsonContent(properties: [new OA\Property(property: 'status', type: 'string', enum: ['queued', 'duplicate', 'ignored', 'pong'])])),
            new OA\Response(response: 400, description: 'Body is not a valid record', content: new OA\JsonContent(ref: '#/components/schemas/Error')),
            new OA\Response(response: 401, description: 'Signature missing or invalid', content: new OA\JsonContent(ref: '#/components/schemas/Error')),
            new OA\Response(response: 503, description: 'Webhook secret is not configured on the server', content: new OA\JsonContent(ref: '#/components/schemas/Error')),
        ],
    )]
    public function __invoke(Request $request): JsonResponse
    {
        $secret = config('woocommerce.webhook_secret');
        if (! $secret) {
            return response()->json(['message' => 'Webhook secret is not configured.'], 503);
        }

        $body = $request->getContent();

        // WooCommerce sends "webhook_id=<n>" as a connectivity ping when a webhook is saved.
        // It carries no data and we act on nothing, so answer it.
        if (preg_match('/^webhook_id=\d+$/', trim($body))) {
            return response()->json(['status' => 'pong']);
        }

        $expected = base64_encode(hash_hmac('sha256', $body, $secret, true));
        if (! hash_equals($expected, (string) $request->header('X-WC-Webhook-Signature'))) {
            return response()->json(['message' => 'Invalid signature.'], 401);
        }

        $topic = (string) $request->header('X-WC-Webhook-Topic');
        [$resource, $event] = array_pad(explode('.', $topic, 2), 2, '');

        if (! in_array($resource, self::RESOURCES, true)) {
            return response()->json(['status' => 'ignored']); // answer 200 so WooCommerce doesn't count a failure
        }

        $payload = json_decode($body, true);
        if (! is_array($payload) || ! isset($payload['id']) || ! is_numeric($payload['id'])) {
            return response()->json(['message' => 'Body is not a valid record.'], 400);
        }

        $deliveryId = $request->header('X-WC-Webhook-Delivery-ID') ?: null;
        if ($deliveryId && WooWebhookDelivery::where('delivery_id', $deliveryId)->exists()) {
            return response()->json(['status' => 'duplicate']);
        }

        $delivery = WooWebhookDelivery::create([
            'delivery_id' => $deliveryId,
            'topic' => $topic,
            'resource' => $resource,
            'event' => $event,
            'woo_id' => (int) $payload['id'],
            'status' => 'received',
        ]);

        try {
            ProcessWooWebhook::dispatchSync($delivery->id, $resource, $event, $payload);

            return response()->json(['status' => 'processed']);
        } catch (Throwable) {
            ProcessWooWebhook::dispatch($delivery->id, $resource, $event, $payload);

            return response()->json(['status' => 'queued']);
        }
    }
}
