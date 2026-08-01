const SITE_TITLE = 'bi-ji'

/** 站点标题：渲染 <title>（React 19 自动提升到 <head>），固定拼接 bi-ji 后缀 */
export function SiteTitle({ title }: { title?: string | null }) {
  return <title>{title ? `${title} - ${SITE_TITLE}` : SITE_TITLE}</title>
}
