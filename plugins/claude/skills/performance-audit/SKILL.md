# Performance Audit Skill

Analyze web page performance using Web Vitals and network timing metrics.

## When to Use

This skill activates when:
- User asks about page performance or speed
- User wants to optimize load times
- User mentions slow page or poor user experience
- User needs Core Web Vitals metrics
- User asks about SEO performance factors

## Capabilities

### Web Vitals Analysis
- Get Core Web Vitals (`o11y_get-web-vitals`)
  - LCP (Largest Contentful Paint)
  - FID (First Input Delay)
  - CLS (Cumulative Layout Shift)
  - TTFB (Time to First Byte)
  - FCP (First Contentful Paint)

### Network Performance
- Analyze request timing (`o11y_get-http-requests`)
- Identify slow API calls
- Check resource sizes
- Find blocking resources

### Visual Analysis
- Capture page at different load stages
- Identify layout shifts visually
- Check above-the-fold content

### JavaScript Analysis
- Profile JavaScript execution
- Check for long tasks
- Identify render-blocking scripts

## Performance Thresholds

| Metric | Good | Needs Work | Poor |
|--------|------|------------|------|
| LCP | ≤2.5s | 2.5-4s | >4s |
| FID | ≤100ms | 100-300ms | >300ms |
| CLS | ≤0.1 | 0.1-0.25 | >0.25 |
| TTFB | ≤800ms | 800-1800ms | >1800ms |

## Audit Workflow

1. **Baseline**: Get initial Web Vitals metrics
2. **Network**: Analyze slow/large requests
3. **Resources**: Check for render-blocking resources
4. **JavaScript**: Look for long tasks
5. **Images**: Check for unoptimized images
6. **Report**: Summarize with recommendations

## Common Issues

- Large unoptimized images
- Render-blocking CSS/JS
- Too many HTTP requests
- Slow server response (TTFB)
- Layout shifts from dynamic content
- Uncompressed resources
