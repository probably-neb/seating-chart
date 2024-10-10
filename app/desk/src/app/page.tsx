import { unstable_noStore as noStore } from "next/cache";

import {Canvas} from "./canvas";

export default async function Home() {
  noStore();

  return (
    <div className="flex justify-center items-center">
        <Canvas />
    </div>
  );
}
