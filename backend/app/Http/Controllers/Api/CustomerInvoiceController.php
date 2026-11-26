<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WooOrder;
use App\Models\WooProduct;
use Illuminate\Http\Response;

class CustomerInvoiceController extends Controller
{
    /**
     * Serves a clean Non-GST Customer Invoice (PDF via Dompdf if installed, or printable A4 HTML)
     * for signed WhatsApp / Interakt delivery links.
     */
    public function show(int $id): Response
    {
        $order = WooOrder::with('items')->findOrFail($id);
        $html = $this->renderHtml($order);

        if (class_exists(\Barryvdh\Dompdf\Facade\Pdf::class)) {
            $pdf = \Barryvdh\Dompdf\Facade\Pdf::loadHTML($html)->setPaper('a4', 'portrait');

            return $pdf->stream("Invoice-{$order->number}.pdf");
        }

        if (class_exists(\Dompdf\Dompdf::class)) {
            $dompdf = new \Dompdf\Dompdf(['isRemoteEnabled' => true]);
            $dompdf->loadHtml($html);
            $dompdf->setPaper('A4', 'portrait');
            $dompdf->render();

            return response($dompdf->output(), 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => "inline; filename=\"Invoice-{$order->number}.pdf\"",
            ]);
        }

        return response($html, 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
        ]);
    }

    /**
     * Serves a clean Packing Slip (PDF via Dompdf if installed, or printable A4 HTML)
     * for Delivered orders on WhatsApp / Interakt.
     */
    public function packingSlip(int $id): Response
    {
        $order = WooOrder::with('items')->findOrFail($id);
        $html = $this->renderPackingSlipHtml($order);

        if (class_exists(\Barryvdh\Dompdf\Facade\Pdf::class)) {
            $pdf = \Barryvdh\Dompdf\Facade\Pdf::loadHTML($html)->setPaper('a4', 'portrait');

            return $pdf->stream("Packing-Slip-{$order->number}.pdf");
        }

        if (class_exists(\Dompdf\Dompdf::class)) {
            $dompdf = new \Dompdf\Dompdf(['isRemoteEnabled' => true]);
            $dompdf->loadHtml($html);
            $dompdf->setPaper('A4', 'portrait');
            $dompdf->render();

            return response($dompdf->output(), 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => "inline; filename=\"Packing-Slip-{$order->number}.pdf\"",
            ]);
        }

        return response($html, 200, [
            'Content-Type' => 'text/html; charset=UTF-8',
        ]);
    }

    private function renderPackingSlipHtml(WooOrder $order): string
    {
        $date = $order->woo_created_at ? $order->woo_created_at->format('m-d-Y') : now()->format('m-d-Y');
        $billing = $order->raw['billing'] ?? [];
        $shipping = $order->raw['shipping'] ?? [];
        $shippingMethod = e($order->raw['shipping_lines'][0]['method_title'] ?? 'Standard Shipping');

        $billName = e(trim(($billing['first_name'] ?? '').' '.($billing['last_name'] ?? '')) ?: ($order->billing_name ?: 'Customer'));
        $billAddr1 = e($billing['address_1'] ?? '');
        $billCity = e(trim(($billing['city'] ?? '').' '.($billing['postcode'] ?? '')));
        $billState = e($billing['state'] ?? '');
        $billEmail = e($billing['email'] ?? ($order->billing_email ?? ''));
        $billPhone = e($billing['phone'] ?? ($order->billing_phone ?? ''));

        $shipName = e(trim(($shipping['first_name'] ?? '').' '.($shipping['last_name'] ?? '')) ?: $billName);
        $shipAddr1 = e(($shipping['address_1'] ?? '') ?: $billAddr1);
        $shipCity = e(trim(($shipping['city'] ?? '').' '.($shipping['postcode'] ?? '')) ?: $billCity);
        $shipState = e(($shipping['state'] ?? '') ?: $billState);
        $shipPhone = e(($shipping['phone'] ?? '') ?: $billPhone);

        $rawItems = collect($order->raw['line_items'] ?? [])->keyBy('id');
        $productImages = WooProduct::whereIn(
            'woo_id',
            $order->items->pluck('product_woo_id')->filter()->all()
        )->pluck('image_url', 'woo_id');

        $rows = '';
        foreach ($order->items as $idx => $item) {
            $rawItem = $rawItems->get($item->woo_item_id);
            $imgUrl = $rawItem['image']['src'] ?? $productImages->get($item->product_woo_id) ?? '';
            $imgTag = $imgUrl
                ? '<img src="'.e($imgUrl).'" alt="" style="width:46px;height:46px;object-fit:cover;border-radius:3px;">'
                : '<span style="color:#94a3b8;">—</span>';
            $sku = e($item->sku ?? '');
            $qty = max(1, (int) $item->quantity);

            $rows .= '<tr>'
                .'<td style="width:52px;">'.($idx + 1).'</td>'
                .'<td style="width:76px;">'.$imgTag.'</td>'
                .'<td style="width:110px;">'.$sku.'</td>'
                .'<td>'.e($item->name).'</td>'
                .'<td style="width:80px;text-align:center;">'.$qty.'</td>'
                .'</tr>';
        }

        $logoUrl = e(rtrim((string) config('app.url'), '/').'/logo.png');

        return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Packing Slip #{$order->number}</title>
<style>
  body { font-family: DejaVu Sans, Arial, sans-serif; color: #1e293b; font-size: 12px; margin: 0; padding: 36px 40px; }
  table.layout { width: 100%; border-collapse: collapse; }
  table.layout td { vertical-align: top; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 28px; }
  table.items th { border-bottom: 1.5px solid #334155; padding: 8px 6px; text-align: left; font-weight: 700; }
  table.items td { border-bottom: 1px solid #e2e8f0; padding: 10px 6px; vertical-align: middle; }
</style>
</head>
<body>
  <table class="layout">
    <tr>
      <td style="width:58%;">
        <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:700;">Packing slip</h1>
        <img src="{$logoUrl}" alt="Lilium & Loft" style="height:44px;width:auto;">
      </td>
      <td style="width:42%;line-height:1.7;">
        <strong>Order No.:</strong> {$order->number}<br>
        <strong>Order Date:</strong> {$date}<br>
        <strong>Shipping Method:</strong> {$shippingMethod}
      </td>
    </tr>
  </table>
  <table class="layout" style="margin-top:26px;line-height:1.6;">
    <tr>
      <td style="width:33%;padding-right:12px;">
        <strong>From</strong><br>
        Lilium and Loft Crochet Studio<br>
        45 (13), 2nd Cross, Venkata Nagar<br>
        605011<br>
        Pondicherry (Puducherry)
      </td>
      <td style="width:34%;padding-right:12px;">
        <strong>Bill to</strong><br>
        {$billName}<br>
        {$billAddr1}<br>
        {$billCity}<br>
        {$billState}<br>
        <strong>Email:</strong> {$billEmail}<br>
        <strong>Phone:</strong> {$billPhone}
      </td>
      <td style="width:33%;">
        <strong>Ship to</strong><br>
        {$shipName}<br>
        {$shipAddr1}<br>
        {$shipCity}<br>
        {$shipState}<br>
        {$shipPhone}
      </td>
    </tr>
  </table>
  <table class="items">
    <thead>
      <tr>
        <th style="width:52px;">S.No</th>
        <th style="width:76px;">Image</th>
        <th style="width:110px;">SKU</th>
        <th>Product</th>
        <th style="width:80px;text-align:center;">Quantity</th>
      </tr>
    </thead>
    <tbody>{$rows}</tbody>
  </table>
</body>
</html>
HTML;
    }

    private function renderHtml(WooOrder $order): string
    {
        $date = $order->woo_created_at ? $order->woo_created_at->format('d-m-Y') : now()->format('d-m-Y');
        $invDate = $order->woo_created_at ? $order->woo_created_at->format('m-d-Y') : now()->format('m-d-Y');
        $invoiceNo = "LLC{$order->number}{$invDate}";
        $billing = $order->raw['billing'] ?? [];
        $shipping = $order->raw['shipping'] ?? [];

        $billName = e(trim(($billing['first_name'] ?? '').' '.($billing['last_name'] ?? '')) ?: ($order->billing_name ?: 'Customer'));
        $billAddr1 = e($billing['address_1'] ?? '');
        $billCity = e(trim(($billing['city'] ?? '').' '.($billing['postcode'] ?? '')));
        $billState = e($billing['state'] ?? '');
        $billPhone = e($billing['phone'] ?? ($order->billing_phone ?? ''));

        $shipName = e(trim(($shipping['first_name'] ?? '').' '.($shipping['last_name'] ?? '')) ?: $billName);
        $shipAddr1 = e(($shipping['address_1'] ?? '') ?: $billAddr1);
        $shipCity = e(trim(($shipping['city'] ?? '').' '.($shipping['postcode'] ?? '')) ?: $billCity);
        $shipState = e(($shipping['state'] ?? '') ?: $billState);
        $shipPhone = e(($shipping['phone'] ?? '') ?: $billPhone);

        $currency = $order->currency === 'INR' ? '₹' : e(($order->currency ?: 'INR').' ');
        $payment = e($order->payment_method_title ?: ($order->payment_method ?: 'Online'));

        $rows = '';
        $subtotal = 0.0;
        foreach ($order->items as $idx => $item) {
            $qty = max(1, (int) $item->quantity);
            $amount = (float) $item->total;
            $rate = $amount / $qty;
            $subtotal += $amount;
            $rows .= '<tr>'
                .'<td style="text-align:center;">'.($idx + 1).'</td>'
                .'<td>'.e($item->name).'</td>'
                .'<td style="text-align:right;">'.number_format($qty, 2).'</td>'
                .'<td style="text-align:right;">'.number_format($rate, 2).'</td>'
                .'<td style="text-align:right;font-weight:600;">'.number_format($amount, 2).'</td>'
                .'</tr>';
        }

        $shippingTotal = (float) $order->shipping_total;
        $discountTotal = (float) $order->discount_total;
        $grandTotal = (float) $order->total;

        $discountRow = $discountTotal > 0
            ? '<tr><td>Discount</td><td style="text-align:right;color:#059669;">-'.$currency.number_format($discountTotal, 2).'</td></tr>'
            : '';

        return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Invoice #{$order->number}</title>
<style>
  body { font-family: DejaVu Sans, Arial, sans-serif; color: #1e293b; font-size: 12px; margin: 0; padding: 32px; }
  table.layout { width: 100%; border-collapse: collapse; }
  table.layout td { vertical-align: top; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 22px; }
  table.items th, table.items td { border: 1px solid #475569; padding: 7px 9px; }
  table.items thead th { background: #f1f5f9; font-weight: 700; }
  table.totals { width: 260px; margin-left: auto; margin-top: 20px; border-collapse: collapse; }
  table.totals td { padding: 4px 0; }
  .grand td { border-top: 1px solid #cbd5e1; padding-top: 8px; font-weight: 700; font-size: 14px; }
</style>
</head>
<body>
  <table class="layout">
    <tr>
      <td style="width:60%;"><h1 style="margin:0;font-size:20px;">INVOICE</h1></td>
      <td style="width:40%;">
        <strong>From</strong><br>
        Lilium and Loft Crochet Studio<br>
        45 (13), 2nd Cross, Venkata Nagar, 605011<br>
        Pondicherry (Puducherry)
      </td>
    </tr>
  </table>
  <table class="layout" style="margin-top:24px;">
    <tr>
      <td style="width:34%;"><strong>Bill to</strong><br>{$billName}<br>{$billAddr1}<br>{$billCity}<br>{$billState}<br>{$billPhone}</td>
      <td style="width:34%;"><strong>Ship to</strong><br>{$shipName}<br>{$shipAddr1}<br>{$shipCity}<br>{$shipState}<br>{$shipPhone}</td>
      <td style="width:32%;">
        <strong>Invoice no:</strong> {$invoiceNo}<br>
        <strong>Order date:</strong> {$date}<br>
        <strong>Payment:</strong> {$payment}
      </td>
    </tr>
  </table>
  <table class="items">
    <thead>
      <tr>
        <th style="width:45px;text-align:center;">S.No</th>
        <th style="text-align:left;">Item</th>
        <th style="width:65px;text-align:right;">Qty</th>
        <th style="width:90px;text-align:right;">Rate</th>
        <th style="width:100px;text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>{$rows}</tbody>
  </table>
  <table class="totals">
    <tr><td>Subtotal</td><td style="text-align:right;">{$currency}{$this->num($subtotal)}</td></tr>
    <tr><td>Shipping</td><td style="text-align:right;">{$currency}{$this->num($shippingTotal)}</td></tr>
    {$discountRow}
    <tr class="grand"><td>Grand Total</td><td style="text-align:right;">{$currency}{$this->num($grandTotal)}</td></tr>
  </table>
  <p style="text-align:center;margin-top:48px;color:#64748b;font-size:11px;">Lilium and Loft Crochet Studio — Thank you for your order!</p>
</body>
</html>
HTML;
    }

    private function num(float $val): string
    {
        return number_format($val, 2);
    }
}
