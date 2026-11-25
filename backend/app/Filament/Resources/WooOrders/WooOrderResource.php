<?php

namespace App\Filament\Resources\WooOrders;

use App\Filament\Resources\WooOrders\Pages\ListWooOrders;
use App\Filament\Resources\WooOrders\Pages\ViewWooOrder;
use App\Models\WooOrder;
use BackedEnum;
use Filament\Actions\ViewAction;
use Filament\Infolists\Components\RepeatableEntry;
use Filament\Infolists\Components\TextEntry;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class WooOrderResource extends Resource
{
    protected static ?string $model = WooOrder::class;

    protected static ?string $modelLabel = 'Order';

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedShoppingBag;

    protected static ?int $navigationSort = 1;

    protected static ?string $recordTitleAttribute = 'number';

    public static function statusColor(?string $status): string
    {
        return match ($status) {
            'completed' => 'success',
            'processing' => 'info',
            'dispatch' => 'primary',
            'on-hold', 'pending' => 'warning',
            'cancelled', 'failed', 'refunded' => 'danger',
            default => 'gray',
        };
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function canEdit($record): bool
    {
        return false;
    }

    public static function canDelete($record): bool
    {
        return false;
    }

    public static function canDeleteAny(): bool
    {
        return false;
    }

    public static function infolist(Schema $schema): Schema
    {
        return $schema->components([
            Section::make('Order')->columns(4)->schema([
                TextEntry::make('number')->label('Order #'),
                TextEntry::make('status')->badge()->color(fn ($state) => self::statusColor($state)),
                TextEntry::make('woo_created_at')->label('Placed')->dateTime(),
                TextEntry::make('woo_paid_at')->label('Paid')->dateTime()->placeholder('-'),
                TextEntry::make('payment_method_title')->label('Payment')->placeholder('-'),
                TextEntry::make('transaction_id')->placeholder('-'),
                TextEntry::make('coupon_codes')->badge()->placeholder('-'),
                TextEntry::make('woo_completed_at')->label('Completed')->dateTime()->placeholder('-'),
            ]),
            Section::make('Totals')->columns(4)->schema([
                TextEntry::make('discount_total')->money('INR'),
                TextEntry::make('shipping_total')->money('INR'),
                TextEntry::make('total_tax')->money('INR'),
                TextEntry::make('total')->money('INR')->weight('bold'),
            ]),
            Section::make('Customer')->columns(3)->schema([
                TextEntry::make('billing_name')->label('Name')->placeholder('-'),
                TextEntry::make('billing_email')->label('Email')->placeholder('-'),
                TextEntry::make('billing_phone')->label('Phone')->placeholder('-'),
                TextEntry::make('billing_city')->label('Billing city')->placeholder('-'),
                TextEntry::make('shipping_city')->label('Shipping city')->placeholder('-'),
                TextEntry::make('shipping_state')->label('Shipping state')->placeholder('-'),
                TextEntry::make('customer_note')->columnSpanFull()->placeholder('-'),
            ]),
            Section::make('Items')->schema([
                RepeatableEntry::make('items')->hiddenLabel()->columns(4)->schema([
                    TextEntry::make('name')->columnSpan(2),
                    TextEntry::make('quantity'),
                    TextEntry::make('total')->money('INR'),
                ]),
            ]),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->defaultSort('woo_created_at', 'desc')
            ->columns([
                TextColumn::make('number')->label('Order #')->searchable()->sortable(),
                TextColumn::make('woo_created_at')->label('Placed')->dateTime()->sortable(),
                TextColumn::make('billing_name')->label('Customer')->searchable()->placeholder('Guest'),
                TextColumn::make('billing_email')->label('Email')->searchable()->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('status')->badge()->color(fn ($state) => self::statusColor($state))->sortable(),
                TextColumn::make('items_count')->counts('items')->label('Items'),
                TextColumn::make('payment_method_title')->label('Payment')->toggleable(),
                TextColumn::make('shipping_state')->label('State')->toggleable(),
                TextColumn::make('total')->money('INR')->sortable()->summarize(\Filament\Tables\Columns\Summarizers\Sum::make()->money('INR')),
            ])
            ->filters([
                SelectFilter::make('status')->options(fn () => WooOrder::query()->distinct()->orderBy('status')->pluck('status', 'status')->all()),
            ])
            ->recordActions([ViewAction::make()]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ListWooOrders::route('/'),
            'view' => ViewWooOrder::route('/{record}'),
        ];
    }
}
