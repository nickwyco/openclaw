# WyCo Vintage — Dymo Label Printer

Recreates the WyCo Vintage price/barcode label (item title, Code 128 barcode,
price, logo) for DYMO LabelWriter printers.

## Quick print (25 ready-made "$40 Rock Tee" labels)

Pre-generated PDFs are in `labels/` — one page per label, pick the one matching
your label roll:

- `rock-tee-40_25up_30336-1x2.125.pdf` — DYMO 30336 (1" × 2-1/8")
- `rock-tee-40_25up_30334-1.25x2.25.pdf` — DYMO 30334 (1-1/4" × 2-1/4")

Open on a computer where the LabelWriter is installed, print at 100% scale with
margins set to none, and select the label size in the Dymo driver.

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
