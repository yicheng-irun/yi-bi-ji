import { useEffect } from 'react'

const BASE_TITLE = 'bi-ji'

/** 设置浏览器标签页标题，卸载时还原为默认标题 */
export function useDocTitle(title?: string | null) {
  useEffect(() => {
    document.title = title ? `${title} - ${BASE_TITLE}` : BASE_TITLE
    return () => { document.title = BASE_TITLE }
  }, [title])
}
