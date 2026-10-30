/** The job as the owner gave it, to look back at when a company replies. The text is shown as text, never as HTML. */
export function OriginalPost({ text, screenshotUrls }: { text: string | null; screenshotUrls: string[] }) {
  if (!text && screenshotUrls.length === 0) return null;
  return (
    <section aria-labelledby="original-post-heading" className="flex flex-col gap-3 border-t border-rule pt-6">
      <h2 id="original-post-heading" className="text-lg font-semibold">
        The job post
      </h2>
      {screenshotUrls.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {screenshotUrls.map((url, index) => (
            <li key={url}>
              <a href={url} target="_blank" rel="noreferrer" className="block outline-offset-2 focus-visible:outline-2 focus-visible:outline-ink">
                {/* The links are signed and expire within the hour, so next/image would cache them past that. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Screenshot ${index + 1}, opens full size`} className="h-48 w-auto rounded-md border border-rule object-cover object-top" />
              </a>
            </li>
          ))}
        </ul>
      )}
      {text && (
        <details className="text-sm">
          <summary className="cursor-pointer text-ink-muted hover:text-ink">The post&apos;s text, word for word</summary>
          <p className="pt-2 break-words whitespace-pre-wrap">{text}</p>
        </details>
      )}
    </section>
  );
}
