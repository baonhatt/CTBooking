'use client';

import type { ReactNode } from 'react';
import { useBranch } from '@/hooks/useBranch';
import { isPostForBranch, type PostBranchIds } from '@/lib/post-branch';

// Hides a post card in a list when the post is limited to other branches than the one the visitor chose.
//
// Why this is done in the browser and not on the server (SEO):
// - The server always sends the complete list. Search engines have no chosen branch, so they see every post and
//   every link, exactly as before. The HTML does not depend on a cookie, so there is no cloaking and no cache variant.
// - On the first render this component shows its children (the same as the server HTML, so hydration matches);
//   only after the visitor's branch is known does it hide the cards that do not apply to that branch.
// - A post limited to one branch is still in the sitemap and can still be opened by its URL from any branch.
export default function BranchScoped({ branchIds, children }: { branchIds: PostBranchIds; children: ReactNode }) {
  const { selectedBranch } = useBranch();
  if (!isPostForBranch(branchIds, selectedBranch?.id)) return null;
  return <>{children}</>;
}
