<?php

namespace App\Services\WhatsApp;

use App\Models\WooOrder;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\URL;

class InteraktService
{
    public function isConfigured(): bool
    {
        return (bool) config('services.interakt.enabled')
            && ! empty(config('services.interakt.api_key'));
    }

    public function sendOrderCreated(WooOrder $order): bool
    {
        $template = (string) config('services.interakt.templates.order_created', 'lilium_loft_order_placed');
        $customerName = $order->billing_name ?: 'Customer';
        $productName = $this->productNames($order);
        $total = $this->formatTotal($order);
        $orderDate = ($order->woo_created_at ?? $order->created_at ?? now())->format('d-m-Y');

        return $this->sendTemplate($order, $template, [
            $customerName,
            "#{$order->number}",
            $productName,
            $total,
            $orderDate,
        ]);
    }

    public function sendOrderProcessing(WooOrder $order): bool
    {
        $template = (string) config('services.interakt.templates.order_processing', 'lilium_loft_order_processing');
        $customerName = $order->billing_name ?: 'Customer';
        $productName = $this->productNames($order);

        return $this->sendTemplate($order, $template, [
            $customerName,
            "#{$order->number}",
            $productName,
        ]);
    }

    public function sendOrderDispatched(WooOrder $order): bool
    {
        $template = (string) config('services.interakt.templates.order_dispatched', 'lilium_loft_order_dispatched');
        $customerName = $order->billing_name ?: 'Customer';
        $productName = $this->productNames($order);
        $courier = $order->courier_name ?: 'Courier Partner';
        $tracking = $order->tracking_number ?: 'N/A';
        $dispatchDate = ($order->dispatched_at ?? now())->format('d-m-Y');

        return $this->sendTemplate($order, $template, [
            $customerName,
            "#{$order->number}",
            $productName,
            $courier,
            $tracking,
            $dispatchDate,
        ]);
    }

    public function sendOrderOutForDelivery(WooOrder $order): bool
    {
        $template = (string) config('services.interakt.templates.out_for_delivery', 'lilium_loft_out_for_delivery');
        $customerName = $order->billing_name ?: 'Customer';
        $productName = $this->productNames($order);
        $courier = $order->courier_name ?: 'Courier Partner';
        $tracking = $order->tracking_number ?: 'N/A';

        return $this->sendTemplate($order, $template, [
            $customerName,
            "#{$order->number}",
            $productName,
            $courier,
            $tracking,
        ]);
    }

    public function sendOrderCompleted(WooOrder $order): bool
    {
        $template = (string) config('services.interakt.templates.order_completed', 'lilium_loft_order_delivered');
        $customerName = $order->billing_name ?: 'Customer';
        $productName = $this->productNames($order);
        $deliveryDate = now()->format('d-m-Y');

        return $this->sendTemplate(
            $order,
            $template,
            [
                $customerName,
                "#{$order->number}",
                $productName,
                $deliveryDate,
            ],
            $this->packingSlipUrl($order),
            "Packing-Slip-{$order->number}.pdf"
        );
    }

    /**
     * Sends a WhatsApp template message via Interakt's Public Message API
     * with the signed Non-GST Customer Invoice (or Packing Slip) document attached in the header.
     *
     * @param  list<string>  $bodyValues
     */
    public function sendTemplate(
        WooOrder $order,
        string $templateName,
        array $bodyValues,
        ?string $documentUrl = null,
        ?string $fileName = null
    ): bool {
        $ctx = [
            'order_id' => $order->id,
            'order_number' => $order->number,
            'order_status' => $order->status,
            'template' => $templateName,
        ];

        // STEP 1: was a send requested at all, and is the service configured on this server?
        Log::info('WA[1] send requested', $ctx + [
            'enabled' => (bool) config('services.interakt.enabled'),
            'api_key_present' => ! empty(config('services.interakt.api_key')),
            'api_key_length' => strlen((string) config('services.interakt.api_key')),
            'base_url' => config('services.interakt.base_url'),
            'app_url' => config('app.url'),
            'raw_phone' => $order->billing_phone,
            'document_override' => $documentUrl !== null,
        ]);

        if (! $this->isConfigured()) {
            Log::warning('WA[1x] skipped: INTERAKT_ENABLED is false or INTERAKT_API_KEY is empty (check .env and run config:clear)', $ctx);

            return false;
        }

        $phone = $this->extractPhone($order);
        if (! $phone) {
            Log::warning('WA[2x] skipped: order has no usable customer phone number', $ctx + [
                'billing_phone' => $order->billing_phone,
            ]);

            return false;
        }
        Log::info('WA[2] phone parsed', $ctx + ['country_code' => $phone[0], 'phone_number' => $phone[1]]);

        [$countryCode, $phoneNumber] = $phone;
        $invoiceUrl = $documentUrl ?: $this->customerInvoiceUrl($order);
        $docFileName = $fileName ?: "Invoice-{$order->number}.pdf";
        $baseUrl = rtrim((string) config('services.interakt.base_url', 'https://api.interakt.ai/v1/public'), '/');
        $apiKey = (string) config('services.interakt.api_key');

        $sanitizedBody = array_map(function ($val): string {
            $clean = trim((string) preg_replace('/\s+/u', ' ', (string) $val));

            return $clean !== '' ? $clean : 'N/A';
        }, array_values($bodyValues));

        $payload = [
            'countryCode' => $countryCode,
            'phoneNumber' => $phoneNumber,
            'callbackData' => "order_{$order->id}_{$order->status}",
            'type' => 'Template',
            'template' => [
                'name' => $templateName,
                'languageCode' => 'en',
                'headerValues' => [$invoiceUrl],
                'fileName' => $docFileName,
                'bodyValues' => $sanitizedBody,
            ],
        ];

        // STEP 3: exactly what we are about to send (API key is never logged).
        Log::info('WA[3] request prepared', $ctx + [
            'url' => "{$baseUrl}/message/",
            'payload' => $payload,
            'body_value_count' => count($sanitizedBody),
            'document_url_is_public' => ! preg_match('#^https?://(localhost|127\.|192\.168\.|10\.)#i', (string) $invoiceUrl),
        ]);

        try {
            $response = Http::withHeaders([
                'Authorization' => "Basic {$apiKey}",
                'Content-Type' => 'application/json',
            ])->timeout(15)->post("{$baseUrl}/message/", $payload);

            // STEP 4: Interakt's answer to the first attempt (with document header).
            Log::info('WA[4] Interakt response (attempt 1, with header)', $ctx + [
                'http_status' => $response->status(),
                'ok' => $response->successful(),
                'body' => mb_substr($response->body(), 0, 2000),
            ]);

            // If template doesn't have a Document header configured in Interakt, retry without headerValues/fileName.
            if ($response->failed() && isset($payload['template']['headerValues'])) {
                Log::warning('WA[5] attempt 1 failed, retrying WITHOUT document header', $ctx);
                unset($payload['template']['headerValues'], $payload['template']['fileName']);
                $response = Http::withHeaders([
                    'Authorization' => "Basic {$apiKey}",
                    'Content-Type' => 'application/json',
                ])->timeout(15)->post("{$baseUrl}/message/", $payload);

                Log::info('WA[6] Interakt response (attempt 2, no header)', $ctx + [
                    'http_status' => $response->status(),
                    'ok' => $response->successful(),
                    'body' => mb_substr($response->body(), 0, 2000),
                ]);
            }

            if ($response->failed()) {
                Log::error('WA[7x] FAILED: Interakt rejected the message', $ctx + [
                    'http_status' => $response->status(),
                    'body' => mb_substr($response->body(), 0, 2000),
                ]);

                return false;
            }

            Log::info('WA[7] SENT: Interakt accepted the message (delivery to the phone is reported by Interakt/Meta separately)', $ctx + [
                'http_status' => $response->status(),
                'body' => mb_substr($response->body(), 0, 1000),
            ]);

            return true;
        } catch (\Throwable $e) {
            Log::error('WA[8x] EXCEPTION while calling Interakt', $ctx + [
                'exception' => get_class($e),
                'message' => $e->getMessage(),
            ]);

            return false;
        }
    }

    public function customerInvoiceUrl(WooOrder $order): string
    {
        return URL::temporarySignedRoute(
            'orders.customer-invoice.public',
            now()->addDays(30),
            ['id' => $order->id]
        );
    }

    public function packingSlipUrl(WooOrder $order): string
    {
        return URL::temporarySignedRoute(
            'orders.packing-slip.public',
            now()->addDays(30),
            ['id' => $order->id]
        );
    }

    /** @return array{0: string, 1: string}|null */
    private function extractPhone(WooOrder $order): ?array
    {
        $raw = $order->billing_phone
            ?: ($order->raw['shipping']['phone'] ?? null)
            ?: ($order->raw['billing']['phone'] ?? null);

        if (! $raw) {
            return null;
        }

        $digits = preg_replace('/\D+/', '', (string) $raw);
        if (! $digits) {
            return null;
        }

        $defaultCode = (string) config('services.interakt.country_code', '+91');
        $defaultDigits = preg_replace('/\D+/', '', $defaultCode) ?: '91';

        if (strlen($digits) === 10) {
            return ["+{$defaultDigits}", $digits];
        }

        if (str_starts_with($digits, $defaultDigits) && strlen($digits) > 10) {
            return ["+{$defaultDigits}", substr($digits, strlen($defaultDigits))];
        }

        // Fallback: last 10 digits with leading country code
        if (strlen($digits) > 10) {
            $cc = substr($digits, 0, strlen($digits) - 10);
            $local = substr($digits, -10);

            return ["+{$cc}", $local];
        }

        return ["+{$defaultDigits}", $digits];
    }

    private function productNames(WooOrder $order): string
    {
        $order->loadMissing('items');
        $names = $order->items
            ->pluck('name')
            ->filter()
            ->map(fn ($n) => trim((string) $n))
            ->values()
            ->all();

        if ($names === []) {
            return 'Order Items';
        }

        return mb_substr(implode(', ', $names), 0, 200);
    }

    private function formatTotal(WooOrder $order): string
    {
        $currency = $order->currency ?: 'INR';
        $symbol = $currency === 'INR' ? '₹' : "{$currency} ";

        return $symbol.number_format((float) $order->total, 2);
    }
}
