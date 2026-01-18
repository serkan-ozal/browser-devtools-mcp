# /pdf

Save the current page as a PDF file.

## Usage

```
/pdf [filename]
```

## Description

Saves the current page as a PDF file. Useful for generating reports, documentation, or archiving web content.

## Arguments

- `filename` (optional): Output filename (default: page title or URL-based name)

## Examples

```
/pdf
/pdf report.pdf
/pdf invoice-2024.pdf
```

## Options

The PDF includes:
- Full page content
- Proper pagination
- Print-optimized styling (uses @media print styles)
- Headers and footers (if configured)

## MCP Tools Used

- `content_save-as-pdf` - Save page as PDF
