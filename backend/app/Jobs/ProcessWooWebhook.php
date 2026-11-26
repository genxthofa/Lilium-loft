<?php

namespace App\Jobs;

use App\Models\WooCoupon;
use App\Models\WooCustomer;
use App\Models\WooOrder;
use App\Models\WooProduct;
use App\Models\WooWebhookDelivery;
use App\Services\WhatsApp\InteraktService;
use App\Services\WooCommerce\WooSyncService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Carbon;
use Throwable;

/**
 * Applies one verified WooCommerce webhook to the LOCAL mirror.
 * It only ever writes to the local database; it never calls WooCommerce.
 */
class ProcessWooWebhook implements ShouldQueue
{
    use Queueable;

    public int $tries = 5;

    /** @param array<string, mixed> $payload */
    public function __construct(
        public int $deliveryId,
        public string $resource,
        public string $event,
        public array $payload,
    ) {}

    /** @return list<int> seconds between retries */
    public function backoff(): array
    {
        return [10, 60, 300, 900];
    }

    public function handle(WooSyncService $sync): void
    {
        $delivery = WooWebhookDelivery::find($this->deliveryId);
        $delivery?->increment('attempts');

        $id = (int) $this->payload['id'];

        if ($this->event === 'deleted') {
            $sync->forget($this->resource, $id);
            $this->finish($delivery, 'processed');

            return;
        }

        // Webhooks can arrive out of order or be repeated: never let an older copy overwrite a newer one.
        if ($this->isStale($id)) {
            $this->finish($delivery, 'ignored');

            return;
        }

        $previousStatus = $this->resource === 'order'
            ? WooOrder::where('woo_id', $id)->value('status')
            : null;

        $stored = match ($this->resource) {
            'order' => $sync->storeOrder($this->payload),
            'product' => $sync->storeProduct($this->payload),
            'customer' => $sync->storeCustomer($this->payload),
            'coupon' => $sync->storeCoupon($this->payload),
        };

        if ($this->resource === 'order' && $stored instanceof WooOrder) {
            $interakt = app(InteraktService::class);
            if ($this->event === 'created' || ($previousStatus === null)) {
                $interakt->sendOrderCreated($stored);
            } elseif ($previousStatus !== $stored->status) {
                match ($stored->status) {
                    'processing' => $interakt->sendOrderCreated($stored),
                    'in-processing' => $interakt->sendOrderProcessing($stored),
                    'dispatch' => $interakt->sendOrderDispatched($stored),
                    'out-for-delivery' => $interakt->sendOrderOutForDelivery($stored),
                    'completed' => $interakt->sendOrderCompleted($stored),
                    default => null,
                };
            }
        }

        $this->finish($delivery, 'processed');
    }

    public function failed(Throwable $e): void
    {
        WooWebhookDelivery::whereKey($this->deliveryId)->update([
            'status' => 'failed',
            'error' => mb_substr($e->getMessage(), 0, 2000),
        ]);
    }

    private function finish(?WooWebhookDelivery $delivery, string $status): void
    {
        $delivery?->update(['status' => $status, 'error' => null, 'processed_at' => now()]);
    }

    /** True when the mirror already holds a version modified after this payload. */
    private function isStale(int $id): bool
    {
        $existing = match ($this->resource) {
            'order' => WooOrder::where('woo_id', $id)->first(),
            'product' => WooProduct::where('woo_id', $id)->first(),
            'customer' => WooCustomer::where('woo_id', $id)->first(),
            'coupon' => WooCoupon::where('woo_id', $id)->first(),
        };

        $have = $existing?->raw['date_modified_gmt'] ?? null;
        $incoming = $this->payload['date_modified_gmt'] ?? null;

        if (! $have || ! $incoming) {
            return false;
        }

        return Carbon::parse($incoming, 'UTC')->lt(Carbon::parse($have, 'UTC'));
    }
}
