# Visual Testing Skill

Perform visual testing and UI verification using screenshots and DOM inspection.

## When to Use

This skill activates when:
- User wants to verify UI appearance
- User asks to compare page with design
- User needs responsive design testing
- User wants to check for visual regressions
- User mentions UI bugs or styling issues

## Capabilities

### Screenshot Capture
- Full page screenshots (`content_take-screenshot`)
- Element-specific screenshots
- Viewport-controlled captures
- PDF generation (`content_save-as-pdf`)

### Responsive Testing
- Resize viewport (`interaction_resize-viewport`)
- Test mobile, tablet, desktop breakpoints
- Verify responsive behavior

### Design Comparison
- Compare with Figma designs (`figma_compare-page-with-design`)
- Visual similarity analysis
- Identify design deviations

### DOM Inspection
- Get HTML structure (`content_get-as-html`)
- Check CSS classes and styles
- Verify element presence and visibility

## Viewport Presets

| Device | Width | Height |
|--------|-------|--------|
| Mobile S | 320px | 568px |
| Mobile M | 375px | 667px |
| Mobile L | 425px | 812px |
| Tablet | 768px | 1024px |
| Laptop | 1366px | 768px |
| Desktop | 1920px | 1080px |

## Testing Workflow

1. **Navigate**: Go to page under test
2. **Wait**: Ensure page fully loaded
3. **Capture**: Take baseline screenshot
4. **Resize**: Test different viewports
5. **Interact**: Test hover states, modals
6. **Compare**: Check against expected design
7. **Document**: Report visual issues

## Common Checks

- Element visibility at breakpoints
- Text overflow and truncation
- Image aspect ratios
- Color and typography consistency
- Spacing and alignment
- Interactive state styling
