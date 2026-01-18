# /text

Get visible text content from the current page.

## Usage

```
/text [selector]
```

## Description

Retrieves the visible text content of the current page or a specific element. Strips HTML tags and returns only human-readable text.

## Arguments

- `selector` (optional): CSS selector to get text of specific element

## Examples

```
/text
/text article
/text .blog-post
/text #product-description
```

## Output

Returns plain text content without HTML markup, preserving basic structure like paragraphs and lists.

## MCP Tools Used

- `content_get-as-text` - Get text content
