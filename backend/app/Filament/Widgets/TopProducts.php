<?php

namespace App\Filament\Widgets;

use App\Models\WooOrderItem;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget;
use Illuminate\Database\Eloquent\Builder;

class TopProducts extends TableWidget
{
    protected static ?int $sort = 4;

    protected int|string|array $columnSpan = 'full';

    protected static ?string $heading = 'Top selling products';

    public function table(Table $table): Table
    {
        return $table
            ->query(fn (): Builder => WooOrderItem::query()
                ->join('woo_orders', 'woo_orders.woo_id', '=', 'woo_order_items.order_woo_id')
                ->whereIn('woo_orders.status', ['completed', 'processing', 'dispatch'])
                ->selectRaw('MIN(woo_order_items.id) as id, woo_order_items.product_woo_id, MIN(woo_order_items.name) as name, SUM(woo_order_items.quantity) as units, SUM(woo_order_items.total) as revenue')
                ->groupBy('woo_order_items.product_woo_id')
                ->orderByDesc('units'))
            ->paginated([5, 10])
            ->defaultKeySort(false)
            ->columns([
                TextColumn::make('name')->label('Product')->wrap(),
                TextColumn::make('units')->label('Units sold'),
                TextColumn::make('revenue')->money('INR'),
            ]);
    }
}
