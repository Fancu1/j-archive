# Icons

This directory should contain the extension icons:

- `icon16.png` - 16x16 pixels (toolbar icon)
- `icon48.png` - 48x48 pixels (extension management page)  
- `icon128.png` - 128x128 pixels (Chrome Web Store)

## Creating Icons

You can create simple placeholder icons or design custom ones. The icon should represent archival/storage functionality.

## Temporary Solution

For development, you can create simple colored squares as placeholders:

```bash
# Create placeholder icons (requires ImageMagick)
convert -size 16x16 xc:blue icons/icon16.png
convert -size 48x48 xc:blue icons/icon48.png  
convert -size 128x128 xc:blue icons/icon128.png
```

Or use any square PNG images renamed to the appropriate sizes. 
