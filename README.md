# WyCo Vintage — Dymo Label Printer

Recreates the WyCo Vintage price/barcode label (item title, Code 128 barcode,
price, logo) for DYMO LabelWriter printers.

## Quick print (25 exact copies of the original label)

`labels/rock-tee-40_EXACT-from-photo_25up_30336-1x2.125.pdf` contains 25 copies
of the original label, extracted pixel-for-pixel from a photo of a printed
label (deskewed, perspective-corrected, cleaned to pure black/white at 600 dpi;
barcode machine-verified to scan as B07042601). Sized for DYMO 30336
(1" x 2-1/8") labels — one page per label.

Open it on a computer where the LabelWriter is installed, print at 100% scale
with margins set to none, and select 30336 as the label size in the Dymo
driver. `labels/label-artwork-600dpi.png` is the source artwork.

## Custom labels

Open `index.html` in any browser on the computer connected to the Dymo.
Set title / SKU / price / label size / quantity and hit **Print**, choosing the
DYMO LabelWriter in the print dialog.

To regenerate a PDF from the command line:

```
npm install
node scripts/make-pdf.mjs out.pdf <qty> <WxH inches> "<title>" "<sku>" "<price>"
# e.g.
node scripts/make-pdf.mjs labels/out.pdf 25 2.125x1 "$40 Rock Tee" "B07042601" "$ 40"
```

## Note on iPhone + USB

DYMO's iOS app (DYMO Connect) only supports their wireless/Bluetooth models
(LabelWriter Wireless, MobileLabeler, LetraTag 200B). A USB-connected
LabelWriter cannot be driven from an iPhone, even over USB-C — print from a
Mac/PC instead.
