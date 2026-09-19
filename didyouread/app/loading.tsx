export default function Loading() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-[#dff1f7]">
      <div className="text-center">
        <span className="mx-auto block size-10 animate-pulse rounded-full bg-[#5ca857]" />
        <p className="mt-3 text-sm font-semibold text-[#315f42]">Tending your garden...</p>
      </div>
    </div>
  );
}
