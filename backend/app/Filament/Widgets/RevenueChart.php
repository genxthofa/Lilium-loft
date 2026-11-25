<?php

namespace App\Filament\Widgets;

use App\Models\WooOrder;
use Filament\Widgets\ChartWidget;
use Illuminate\Support\Carbon;

class RevenueChart extends ChartWidget
{
    protected static ?int $sort = 2;

    protected ?string $heading = 'Daily revenue (last 30 days)';

    protected int|string|array $columnSpan = 'full';

    protected function getData(): array
    {
        $from = now()->subDays(29)->startOfDay();

        $byDay = WooOrder::whereIn('status', ['completed', 'processing', 'dispatch'])
            ->where('woo_created_at', '>=', $from)
            ->selectRaw('DATE(woo_created_at) as d, SUM(total) as t')
            ->groupBy('d')->pluck('t', 'd');

        $labels = [];
        $data = [];
        for ($i = 0; $i < 30; $i++) {
            $day = Carbon::parse($from)->addDays($i);
            $labels[] = $day->format('d M');
            $data[] = (float) ($byDay[$day->toDateString()] ?? 0);
        }

        return [
            'datasets' => [['label' => 'Revenue (₹)', 'data' => $data, 'fill' => true, 'tension' => 0.3]],
            'labels' => $labels,
        ];
    }

    protected function getType(): string
    {
        return 'line';
    }
}
