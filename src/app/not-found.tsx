import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <p className="font-display text-6xl tracking-wide text-danger">NOT FOUND</p>
      <h1 className="mt-2 text-xl font-bold">That page does not exist.</h1>
      <p className="mt-2 text-base text-muted-foreground">The module may not be open yet, or the link is wrong.</p>
      <Link href="/" className={buttonVariants({ size: "lg", className: "mt-6" })}>
        Back to the home page
      </Link>
    </div>
  );
}
