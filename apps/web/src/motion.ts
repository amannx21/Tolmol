import { useEffect, useRef } from "preact/hooks"

/** Content stays visible when motion or IntersectionObserver is unavailable. */
export function useReveal() {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const container = root.current
    if (!container || !("IntersectionObserver" in window)) return
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)")
    const elements = Array.from(container.querySelectorAll<HTMLElement>("[data-reveal]"))
    let observer: IntersectionObserver | undefined
    const reveal = (element: HTMLElement) => {
      element.dataset.revealState = "visible"
      observer?.unobserve(element)
    }
    const configure = () => {
      observer?.disconnect()
      if (preference.matches) {
        elements.forEach((element) => { delete element.dataset.revealState })
        return
      }
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) if (entry.isIntersecting) reveal(entry.target as HTMLElement)
      }, { threshold: 0.05, rootMargin: "0px 0px -24px 0px" })
      for (const element of elements) {
        // Above-the-fold content is immediately readable; reveal only what is below it.
        if (element.dataset.revealState === "visible" || element.getBoundingClientRect().top < window.innerHeight) reveal(element)
        else {
          element.dataset.revealState = "pending"
          observer.observe(element)
        }
      }
    }
    const onFocus = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return
      const element = event.target.closest<HTMLElement>("[data-reveal]")
      if (element) reveal(element)
    }
    configure()
    container.addEventListener("focusin", onFocus)
    preference.addEventListener("change", configure)
    return () => {
      observer?.disconnect()
      container.removeEventListener("focusin", onFocus)
      preference.removeEventListener("change", configure)
      elements.forEach((element) => { delete element.dataset.revealState })
    }
  }, [])
  return root
}
