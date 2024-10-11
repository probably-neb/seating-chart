import { unstable_noStore as noStore } from "next/cache";

import dynamic from "next/dynamic";

const Canvas = dynamic(() => import("./canvas").then(c => c.Canvas), {
    ssr: false,
})

export default async function Home() {
  noStore();

  return (
    <div className="flex justify-center items-center">
        <Canvas />
    </div>
  );
}
