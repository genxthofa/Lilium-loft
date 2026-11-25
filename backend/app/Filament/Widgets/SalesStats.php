<?php

namespace App\Filament\Widgets;

use App\Models\WooCustomer;
use App\Models\WooOrder;
use App\Models\WooProduct;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

class SalesStats extends StatsOverviewWidget
{
    protected static ?int $sort = 1;

    protected ?string $heading = 'Last 30 days';

    protected function getStats(): array
    {
        $paid = ['completed', 'processing', 'dispatch'];
        $now = now();

        $current = WooOrder::whereIn('status', $paid)->where('woo_created_at', '>=', $now->copy()->subDays(30));
        $previous = WooOrder::whereIn('status', $paid)->whereBetween('woo_created_at', [$now->copy()->subDays(60), $now->copy()->subDays(30)]);

        $revenue = (float) $current->sum('total');
        $prevRevenue = (float) $previous->sum('total');
        $orders = $current->count();
        $prevOrders = $previous->count();

        $trend = fn (float $a, float $b) => $b > 0 ? round((($a - $b) / $b) * 100).'% vs previous 30 days' : 'No earlier data';
        $color = fn (float $a, float $b) => $a >= $b ? 'success' : 'danger';

        return [
            Stat::make('Revenue', '₹'.number_format($revenue, 2))
                ->description($trend($revenue, $prevRevenue))->color($color($revenue, $prevRevenue)),
            Stat::make('Orders', $orders)
                ->description($trend($orders, $prevOrders))->color($color($orders, $prevOrders)),
            Stat::make('Average order value', '₹'.number_format($orders ? $revenue / $orders : 0, 2)),
            Stat::make('Awaiting fulfilment', WooOrder::whereIn('status', ['processing', 'on-hold', 'pending'])->count())
                ->description('processing / on-hold / pending')->color('warning'),
            Stat::make('Customers', WooCustomer::count()),
            Stat::make('Out of stock', WooProduct::where('status', 'publish')->where('stock_status', 'outofstock')->count())
                ->description(WooProduct::where('status', 'publish')->count().' published products')->color('danger'),
        ];
    }
}
