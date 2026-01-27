# Interaction Tools

User interaction simulation commands.

## click

Click an element on the page.

```bash
browser-devtools-cli interaction click --selector <selector>
```

**Arguments:**

| Argument | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `--selector` | string | Yes | - | CSS selector for element to click |

**Examples:**

```bash
# Click a button
browser-devtools-cli interaction click --selector "button#submit"

# Click a link
browser-devtools-cli interaction click --selector "a.nav-link"

# Click by data-testid
browser-devtools-cli interaction click --selector "[data-testid='login-btn']"
```

---

## fill

Fill out an input field (clears existing content first).

```bash
browser-devtools-cli interaction fill --selector <selector> --value <value>
```

**Arguments:**

| Argument | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `--selector` | string | Yes | - | CSS selector for input field |
| `--value` | string | Yes | - | Value to fill |

**Examples:**

```bash
# Fill text input
browser-devtools-cli interaction fill --selector "#email" --value "user@example.com"

# Fill password
browser-devtools-cli interaction fill --selector "input[type=password]" --value "secret123"

# Fill textarea
browser-devtools-cli interaction fill --selector "textarea#message" --value "Hello world"
```

---

## hover

Hover over an element.

```bash
browser-devtools-cli interaction hover --selector <selector>
```

**Arguments:**

| Argument | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `--selector` | string | Yes | - | CSS selector for element to hover |

**Examples:**

```bash
# Hover over menu
browser-devtools-cli interaction hover --selector ".dropdown-menu"

# Hover to reveal tooltip
browser-devtools-cli interaction hover --selector "[data-tooltip]"
```

---

## select

Select an option from a dropdown.

```bash
browser-devtools-cli interaction select --selector <selector> --value <value>
```

**Arguments:**

| Argument | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `--selector` | string | Yes | - | CSS selector for select element |
| `--value` | string | Yes | - | Option value to select |

**Examples:**

```bash
# Select by value
browser-devtools-cli interaction select --selector "#country" --value "US"

# Select by visible text
browser-devtools-cli interaction select --selector "#size" --value "Large"
```

---

## press-key

Press a keyboard key.

```bash
browser-devtools-cli interaction press-key --key <key> [options]
```

**Arguments:**

| Argument | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `--key` | string | Yes | - | Key to press (e.g., Enter, Tab, Escape) |
| `--selector` | string | No | - | Element to focus before pressing |

**Examples:**

```bash
# Press Enter
browser-devtools-cli interaction press-key --key "Enter"

# Press Tab to navigate
browser-devtools-cli interaction press-key --key "Tab"

# Press Escape to close modal
browser-devtools-cli interaction press-key --key "Escape"

# Press on specific element
browser-devtools-cli interaction press-key --selector "#search" --key "Enter"
```

---

## scroll

Scroll the page or an element.

```bash
browser-devtools-cli interaction scroll [options]
```

**Arguments:**

| Argument | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `--selector` | string | No | - | Element to scroll (defaults to page) |
| `--direction` | enum | No | `down` | Scroll direction: up, down, left, right |
| `--amount` | number | No | `100` | Scroll amount in pixels |

**Examples:**

```bash
# Scroll down
browser-devtools-cli interaction scroll --direction down --amount 500

# Scroll element into view
browser-devtools-cli interaction scroll --selector "#footer"

# Scroll up
browser-devtools-cli interaction scroll --direction up --amount 200
```

---

## drag

Drag an element to another location.

```bash
browser-devtools-cli interaction drag --source <selector> --target <selector>
```

**Arguments:**

| Argument | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `--source` | string | Yes | - | CSS selector for element to drag |
| `--target` | string | Yes | - | CSS selector for drop target |

**Example:**

```bash
browser-devtools-cli interaction drag --source ".draggable" --target ".dropzone"
```

---

## resize-viewport

Resize the browser viewport.

```bash
browser-devtools-cli interaction resize-viewport --width <px> --height <px>
```

**Arguments:**

| Argument | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `--width` | number | Yes | - | Viewport width in pixels |
| `--height` | number | Yes | - | Viewport height in pixels |

**Examples:**

```bash
# Mobile viewport
browser-devtools-cli interaction resize-viewport --width 375 --height 667

# Desktop viewport
browser-devtools-cli interaction resize-viewport --width 1920 --height 1080

# Tablet viewport
browser-devtools-cli interaction resize-viewport --width 768 --height 1024
```

---

## resize-window

Resize the browser window.

```bash
browser-devtools-cli interaction resize-window --width <px> --height <px>
```

**Arguments:**

| Argument | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `--width` | number | Yes | - | Window width in pixels |
| `--height` | number | Yes | - | Window height in pixels |

## Form Automation Example

```bash
SESSION="--session-id form-test"

# Navigate to form
browser-devtools-cli $SESSION navigation go-to --url "https://example.com/signup"

# Fill registration form
browser-devtools-cli $SESSION interaction fill --selector "#firstName" --value "John"
browser-devtools-cli $SESSION interaction fill --selector "#lastName" --value "Doe"
browser-devtools-cli $SESSION interaction fill --selector "#email" --value "john@example.com"
browser-devtools-cli $SESSION interaction fill --selector "#password" --value "SecurePass123!"

# Select country
browser-devtools-cli $SESSION interaction select --selector "#country" --value "US"

# Check terms checkbox
browser-devtools-cli $SESSION interaction click --selector "#terms"

# Submit form
browser-devtools-cli $SESSION interaction click --selector "button[type=submit]"

# Wait for response
browser-devtools-cli $SESSION sync wait-for-network-idle

# Verify success
browser-devtools-cli $SESSION content get-as-text --selector ".success-message"
```

## Responsive Testing Example

```bash
SESSION="--session-id responsive-test"

# Navigate
browser-devtools-cli $SESSION navigation go-to --url "https://example.com"

# Test mobile
browser-devtools-cli $SESSION interaction resize-viewport --width 375 --height 667
browser-devtools-cli $SESSION content take-screenshot --name "mobile"

# Test tablet
browser-devtools-cli $SESSION interaction resize-viewport --width 768 --height 1024
browser-devtools-cli $SESSION content take-screenshot --name "tablet"

# Test desktop
browser-devtools-cli $SESSION interaction resize-viewport --width 1920 --height 1080
browser-devtools-cli $SESSION content take-screenshot --name "desktop"
```
