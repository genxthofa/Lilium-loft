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
            $pdf = \Barryvdh\Dompdf\Facade\Pdf::setOptions(['isRemoteEnabled' => true])
                ->loadHTML($html)
                ->setPaper('a4', 'portrait');

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

        $pdfBinary = $this->buildCustomerInvoicePdf($order);

        return response($pdfBinary, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => "inline; filename=\"Invoice-{$order->number}.pdf\"",
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
            $pdf = \Barryvdh\Dompdf\Facade\Pdf::setOptions(['isRemoteEnabled' => true])
                ->loadHTML($html)
                ->setPaper('a4', 'portrait');

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

        $pdfBinary = $this->buildPackingSlipPdf($order);

        return response($pdfBinary, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => "inline; filename=\"Packing-Slip-{$order->number}.pdf\"",
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
        $billAddr2 = e($billing['address_2'] ?? '');
        $billCity = e(trim(($billing['city'] ?? '').' '.($billing['postcode'] ?? '')));
        $billState = e($billing['state'] ?? '');
        $billEmail = e($billing['email'] ?? ($order->billing_email ?? ''));
        $billPhone = e($billing['phone'] ?? ($order->billing_phone ?? ''));

        $shipName = e(trim(($shipping['first_name'] ?? '').' '.($shipping['last_name'] ?? '')) ?: $billName);
        $shipAddr1 = e(($shipping['address_1'] ?? '') ?: $billAddr1);
        $shipAddr2 = e(($shipping['address_2'] ?? '') ?: $billAddr2);
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
                ? '<img src="'.e($imgUrl).'" alt="" style="width:52px;height:52px;object-fit:cover;border-radius:6px;">'
                : '<span style="color:#94a3b8;">—</span>';
            $sku = e($item->sku ?? '');
            $qty = max(1, (int) $item->quantity);

            $rows .= '<tr>'
                .'<td style="width:68px;">'.($idx + 1).'</td>'
                .'<td style="width:120px;">'.$imgTag.'</td>'
                .'<td style="width:95px;">'.$sku.'</td>'
                .'<td>'.e($item->name).'</td>'
                .'<td style="width:90px;text-align:center;">'.$qty.'</td>'
                .'</tr>';
        }

        $logoUrl = $this->logoDataUri();

        return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Packing Slip #{$order->number}</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  body { font-family: DejaVu Sans, Arial, sans-serif; color: #1e293b; font-size: 11.5px; margin: 0; padding: 8px 14px; }
  table.layout { width: 100%; border-collapse: collapse; }
  table.layout td { vertical-align: top; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 26px; }
  table.items th { border-bottom: 1px solid #cbd5e1; padding: 8px 6px; text-align: left; font-weight: 700; color: #0f172a; }
  table.items td { border-bottom: 1px solid #e2e8f0; padding: 10px 6px; vertical-align: middle; }
</style>
</head>
<body>
  <table class="layout">
    <tr>
      <td style="width:67%;">
        <div style="margin:0 0 14px 0;font-size:24px;font-weight:700;color:#1e293b;">Packing slip</div>
        <img src="{$logoUrl}" alt="Lilium & Loft" style="height:46px;width:auto;">
      </td>
      <td style="width:33%;padding-top:38px;line-height:1.7;">
        <strong>Order No.:</strong> {$order->number}<br>
        <strong>Order Date:</strong> {$date}<br>
        <strong>Shipping Method:</strong> {$shippingMethod}
      </td>
    </tr>
  </table>
  <table class="layout" style="margin-top:26px;line-height:1.6;">
    <tr>
      <td style="width:33%;padding-right:12px;">
        <strong style="display:block;margin-bottom:3px;">From</strong>
        Lilium and Loft Crochet Studio<br>
        45 (13), 2nd Cross, Venkata Nagar<br>
        605011<br>
        Pondicherry (Puducherry)
      </td>
      <td style="width:34%;padding-right:12px;">
        <strong style="display:block;margin-bottom:3px;">Bill to</strong>
        {$billName}<br>
        {$billAddr1}<br>
        {$billAddr2}
        {$billCity}<br>
        {$billState}<br>
        <strong>Email:</strong> {$billEmail}<br>
        <strong>Phone:</strong> {$billPhone}
      </td>
      <td style="width:33%;">
        <strong style="display:block;margin-bottom:3px;">Ship to</strong>
        {$shipName}<br>
        {$shipAddr1}<br>
        {$shipAddr2}
        {$shipCity}<br>
        {$shipState}<br>
        {$shipPhone}
      </td>
    </tr>
  </table>
  <table class="items">
    <thead>
      <tr>
        <th style="width:68px;">S.No</th>
        <th style="width:120px;">Image</th>
        <th style="width:95px;">SKU</th>
        <th>Product</th>
        <th style="width:90px;text-align:center;">Quantity</th>
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
        $billAddr2 = e($billing['address_2'] ?? '');
        $billCity = e(trim(($billing['city'] ?? '').' '.($billing['postcode'] ?? '')));
        $billState = e($billing['state'] ?? '');
        $billPhone = e($billing['phone'] ?? ($order->billing_phone ?? ''));

        $shipName = e(trim(($shipping['first_name'] ?? '').' '.($shipping['last_name'] ?? '')) ?: $billName);
        $shipAddr1 = e(($shipping['address_1'] ?? '') ?: $billAddr1);
        $shipAddr2 = e(($shipping['address_2'] ?? '') ?: $billAddr2);
        $shipCity = e(trim(($shipping['city'] ?? '').' '.($shipping['postcode'] ?? '')) ?: $billCity);
        $shipState = e(($shipping['state'] ?? '') ?: $billState);
        $shipPhone = e(($shipping['phone'] ?? '') ?: $billPhone);

        $currency = $order->currency === 'INR' ? '₹' : e(($order->currency ?: 'INR').' ');
        $payment = e(ucwords($order->payment_method_title ?: ($order->payment_method ?: 'Online')));

        $stampText = match (strtolower((string) $order->status)) {
            'refunded' => 'REFUNDED',
            'cancelled' => 'CANCELLED',
            'on-hold', 'pending' => 'PENDING',
            default => 'RECEIVED',
        };

        $rawItems = collect($order->raw['line_items'] ?? [])->keyBy('id');
        $productImages = WooProduct::whereIn(
            'woo_id',
            $order->items->pluck('product_woo_id')->filter()->all()
        )->pluck('image_url', 'woo_id');

        $rows = '';
        $subtotal = 0.0;
        foreach ($order->items as $idx => $item) {
            $qty = max(1, (int) $item->quantity);
            $amount = (float) $item->total;
            $rate = $amount / $qty;
            $subtotal += $amount;

            $rawItem = $rawItems->get($item->woo_item_id);
            $imgUrl = $rawItem['image']['src'] ?? $productImages->get($item->product_woo_id) ?? '';
            $imgTag = $imgUrl
                ? '<img src="'.e($imgUrl).'" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:3px;border:1px solid #cbd5e1;">'
                : '<span style="color:#94a3b8;">—</span>';

            $rows .= '<tr>'
                .'<td style="text-align:center;">'.($idx + 1).'</td>'
                .'<td style="text-align:center;">'.$imgTag.'</td>'
                .'<td style="font-weight:500;">'.e($item->name).'</td>'
                .'<td style="text-align:right;">'.number_format($qty, 2).'</td>'
                .'<td style="text-align:right;">'.number_format($rate, 2).'</td>'
                .'<td style="text-align:right;font-weight:700;">'.number_format($amount, 2).'</td>'
                .'</tr>';
        }

        $shippingTotal = (float) $order->shipping_total;
        $discountTotal = (float) $order->discount_total;
        $grandTotal = (float) $order->total;

        $discountRow = $discountTotal > 0
            ? '<tr><td>Discount</td><td style="text-align:right;color:#059669;">-'.$currency.number_format($discountTotal, 2).'</td></tr>'
            : '';

        $logoUrl = $this->logoDataUri();
        $shippingDisplay = $shippingTotal > 0 ? $currency.number_format($shippingTotal, 2) : 'Free';

        return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Invoice #{$order->number}</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  body { font-family: DejaVu Sans, Arial, sans-serif; color: #1e293b; font-size: 11.5px; line-height: 1.5; margin: 0; padding: 8px 14px; }
  table.layout { width: 100%; border-collapse: collapse; }
  table.layout td { vertical-align: top; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 22px; }
  table.items th, table.items td { border: 1px solid #475569; padding: 6px 8px; }
  table.items thead th { background: #f1f5f9; font-weight: 700; color: #0f172a; }
  table.totals { width: 100%; border-collapse: collapse; font-size: 12px; }
  table.totals td { padding: 4px 0; color: #334155; }
  .grand td { border-top: 1px solid #e2e8f0; padding-top: 8px; font-weight: 700; font-size: 13.5px; color: #0f172a; }
  .stamp { display: inline-block; padding: 5px 14px; border: 3px solid #a87575; border-radius: 6px; color: #a87575; font-weight: 800; font-size: 16px; letter-spacing: 2px; text-transform: uppercase; transform: rotate(-45deg); }
  .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; color: #475569; font-size: 11px; }
</style>
</head>
<body>
  <table class="layout">
    <tr>
      <td style="width:62%;">
        <div style="font-size:20px;font-weight:800;letter-spacing:0.04em;margin-bottom:10px;">INVOICE</div>
        <img src="{$logoUrl}" alt="Lilium & Loft" style="height:48px;width:auto;">
      </td>
      <td style="width:38%;line-height:1.6;">
        <strong style="display:block;margin-bottom:3px;">From</strong>
        Lilium and Loft Crochet Studio<br>
        45 (13), 2nd Cross, Venkata Nagar<br>
        605011<br>
        Pondicherry (Puducherry)
      </td>
    </tr>
  </table>
  <table class="layout" style="margin-top:24px;line-height:1.6;">
    <tr>
      <td style="width:34%;padding-right:10px;">
        <strong style="display:block;margin-bottom:3px;">Bill to</strong>
        <strong>{$billName}</strong><br>
        {$billAddr1}<br>
        {$billAddr2}
        {$billCity}<br>
        {$billState}<br>
        {$billPhone}
      </td>
      <td style="width:34%;padding-right:10px;">
        <strong style="display:block;margin-bottom:3px;">Ship to</strong>
        <strong>{$shipName}</strong><br>
        {$shipAddr1}<br>
        {$shipAddr2}
        {$shipCity}<br>
        {$shipState}<br>
        {$shipPhone}
      </td>
      <td style="width:32%;">
        <table class="layout" style="line-height:1.6;">
          <tr><td style="font-weight:700;padding-right:8px;white-space:nowrap;">Invoice no:</td><td>{$invoiceNo}</td></tr>
          <tr><td style="font-weight:700;padding-right:8px;white-space:nowrap;">Order date:</td><td>{$date}</td></tr>
          <tr><td style="font-weight:700;padding-right:8px;white-space:nowrap;">Payment method:</td><td>{$payment}</td></tr>
        </table>
      </td>
    </tr>
  </table>
  <table class="items">
    <thead>
      <tr>
        <th style="width:38px;text-align:center;">S.No</th>
        <th style="width:54px;text-align:center;">Image</th>
        <th style="text-align:left;">Item</th>
        <th style="width:56px;text-align:right;">Qty</th>
        <th style="width:82px;text-align:right;">Rate</th>
        <th style="width:88px;text-align:right;">Amount</th>
      </tr>
    </thead>
    <tbody>{$rows}</tbody>
  </table>
  <table class="layout" style="margin-top:28px;">
    <tr>
      <td style="width:56%;text-align:center;vertical-align:middle;padding-top:22px;">
        <div class="stamp">{$stampText}</div>
      </td>
      <td style="width:44%;">
        <table class="totals">
          <tr><td>Subtotal</td><td style="text-align:right;">{$currency}{$this->num($subtotal)}</td></tr>
          <tr><td>Shipping</td><td style="text-align:right;">{$shippingDisplay}</td></tr>
          {$discountRow}
          <tr class="grand"><td>Grand Total</td><td style="text-align:right;">{$currency}{$this->num($grandTotal)}</td></tr>
        </table>
      </td>
    </tr>
  </table>
  <div class="footer">Lilium and Loft Crochet Studio — Thank you for your order!</div>
</body>
</html>
HTML;
    }

    private function num(float $val): string
    {
        return number_format($val, 2);
    }

    private function logoDataUri(): string
    {
        $path = public_path('logo.png');
        if (is_file($path)) {
            $raw = file_get_contents($path);
            if ($raw !== false) {
                return 'data:image/png;base64,'.base64_encode($raw);
            }
        }

        return e(rtrim((string) config('app.url'), '/').'/logo.png');
    }

    private function buildCustomerInvoicePdf(WooOrder $order): string
    {
        $date = $order->woo_created_at ? $order->woo_created_at->format('d-m-Y') : now()->format('d-m-Y');
        $invDate = $order->woo_created_at ? $order->woo_created_at->format('m-d-Y') : now()->format('m-d-Y');
        $invoiceNo = "LLC{$order->number}{$invDate}";
        $lines = [
            'LILIUM AND LOFT CROCHET STUDIO - INVOICE',
            '------------------------------------------------------------',
            "Invoice No: {$invoiceNo}    Order No: #{$order->number}    Date: {$date}",
            'From: 45 (13), 2nd Cross, Venkata Nagar, Pondicherry 605011',
            'Bill To: '.($order->billing_name ?: 'Customer').' | '.($order->billing_phone ?: ''),
            '------------------------------------------------------------',
            'Items:',
        ];
        foreach ($order->items as $idx => $item) {
            $lines[] = sprintf('%d. %s  x%d  = INR %s', $idx + 1, $item->name, max(1, (int) $item->quantity), number_format((float) $item->total, 2));
        }
        $lines[] = '------------------------------------------------------------';
        $lines[] = 'Shipping: INR '.number_format((float) $order->shipping_total, 2);
        $lines[] = 'Grand Total: INR '.number_format((float) $order->total, 2);
        $lines[] = '';
        $lines[] = 'Thank you for shopping with Lilium & Loft Crochet Studio!';

        return $this->renderSimplePdf($lines);
    }

    private function buildPackingSlipPdf(WooOrder $order): string
    {
        $date = $order->woo_created_at ? $order->woo_created_at->format('m-d-Y') : now()->format('m-d-Y');
        $shippingMethod = $order->raw['shipping_lines'][0]['method_title'] ?? 'Standard Shipping';
        $lines = [
            'LILIUM AND LOFT CROCHET STUDIO - PACKING SLIP',
            '------------------------------------------------------------',
            "Order No: #{$order->number}    Order Date: {$date}",
            "Shipping Method: {$shippingMethod}",
            'From: 45 (13), 2nd Cross, Venkata Nagar, Pondicherry 605011',
            'Ship To: '.($order->billing_name ?: 'Customer').' | '.($order->billing_phone ?: ''),
            '------------------------------------------------------------',
            'Items:',
        ];
        foreach ($order->items as $idx => $item) {
            $sku = $item->sku ? " [SKU: {$item->sku}]" : '';
            $lines[] = sprintf('%d. %s%s  - Qty: %d', $idx + 1, $item->name, $sku, max(1, (int) $item->quantity));
        }
        $lines[] = '------------------------------------------------------------';
        $lines[] = 'Thank you for your order!';

        return $this->renderSimplePdf($lines);
    }

    /** Generates a valid single-page PDF 1.4 binary without external dependencies. */
    private function renderSimplePdf(array $lines): string
    {
        $esc = fn (string $s): string => str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], preg_replace('/[^\x20-\x7E]/', ' ', $s) ?? '');
        $stream = "BT\n/F1 11 Tf\n50 770 Td\n16 TL\n";
        foreach ($lines as $i => $line) {
            $text = $esc($line);
            $stream .= $i === 0 ? "({$text}) Tj\n" : "T* ({$text}) Tj\n";
        }
        $stream .= "ET\n";

        $objects = [
            1 => "<< /Type /Catalog /Pages 2 0 R >>",
            2 => "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            3 => "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
            4 => "<< /Length ".strlen($stream)." >>\nstream\n{$stream}endstream",
            5 => "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        ];

        $pdf = "%PDF-1.4\n";
        $offsets = [0 => 0];
        foreach ($objects as $num => $body) {
            $offsets[$num] = strlen($pdf);
            $pdf .= "{$num} 0 obj\n{$body}\nendobj\n";
        }
        $xrefOffset = strlen($pdf);
        $pdf .= "xref\n0 ".(count($objects) + 1)."\n0000000000 65535 f \n";
        foreach ($objects as $num => $_) {
            $pdf .= sprintf("%010d 00000 n \n", $offsets[$num]);
        }
        $pdf .= "trailer\n<< /Size ".(count($objects) + 1)." /Root 1 0 R >>\nstartxref\n{$xrefOffset}\n%%EOF";

        return $pdf;
    }
}
