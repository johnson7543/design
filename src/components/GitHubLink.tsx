import { useEffect, useState } from 'react';

const DESIGN_GITHUB_URL = 'https://github.com/johnson7543/design';
const DESIGN_GITHUB_API_URL = 'https://api.github.com/repos/johnson7543/design';
const DESIGN_GITHUB_STAR_FALLBACK = 4;

function GitHubMarkIcon() {
  return (
    <svg
      className="github-star-mark"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
    >
      <path d="M6.766 11.328c-2.063-.25-3.516-1.734-3.516-3.656 0-.781.281-1.625.75-2.188-.203-.515-.172-1.609.063-2.062.625-.078 1.468.25 1.968.703.594-.187 1.219-.281 1.985-.281.765 0 1.39.094 1.953.265.484-.437 1.344-.765 1.969-.687.218.422.25 1.515.046 2.047.5.593.766 1.39.766 2.203 0 1.922-1.453 3.375-3.547 3.64.531.344.89 1.094.89 1.954v1.625c0 .468.391.734.86.547C13.781 14.359 16 11.53 16 8.03 16 3.61 12.406 0 7.984 0 3.563 0 0 3.61 0 8.031a7.88 7.88 0 0 0 5.172 7.422c.422.156.828-.125.828-.547v-1.25c-.219.094-.5.156-.75.156-1.031 0-1.64-.562-2.078-1.609-.172-.422-.36-.672-.719-.719-.187-.015-.25-.093-.25-.187 0-.188.313-.328.625-.328.453 0 .844.281 1.25.86.313.452.64.655 1.031.655s.641-.14 1-.5c.266-.265.47-.5.657-.656" />
    </svg>
  );
}

function formatGitHubStarCount(count: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(count);
}

export function GitHubLink({ productName }: { productName: string }) {
  const [githubStarCount, setGitHubStarCount] = useState(
    DESIGN_GITHUB_STAR_FALLBACK
  );

  useEffect(() => {
    const controller = new AbortController();

    void fetch(DESIGN_GITHUB_API_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error('GitHub star count is unavailable.');
        return response.json() as Promise<{ stargazers_count?: unknown }>;
      })
      .then(({ stargazers_count: count }) => {
        if (
          !controller.signal.aborted
          && typeof count === 'number'
          && Number.isInteger(count)
          && count >= 0
        ) {
          setGitHubStarCount(count);
        }
      })
      .catch(() => {
        // Retain the last verified count when GitHub is unavailable or rate-limited.
      });

    return () => controller.abort();
  }, []);

  const formattedGitHubStarCount = formatGitHubStarCount(githubStarCount);

  return (
    <a
      className="github-star-link"
      href={DESIGN_GITHUB_URL}
      target="_blank"
      rel="noreferrer"
      aria-label={`Star ${productName} on GitHub; ${githubStarCount} stars (opens in a new tab)`}
      title={`Star ${productName} on GitHub · ${githubStarCount} stars`}
      data-github-star-count={githubStarCount}
    >
      <GitHubMarkIcon />
      <span className="github-star-count" aria-hidden="true">
        {formattedGitHubStarCount}
      </span>
    </a>
  );
}
