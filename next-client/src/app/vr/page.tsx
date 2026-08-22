import { redirect } from 'next/navigation';

export default function VRPage({ searchParams }: { searchParams?: { branch_id?: string } }) {
  const branchParam = searchParams?.branch_id ? `?branch_id=${searchParams.branch_id}` : '';
  redirect(`/${branchParam}#vr`);
}
