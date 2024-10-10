import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";

export const postRouter = createTRPCRouter({
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),

  create: publicProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async () => {
      // simulate a slow db call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // await ctx.db.insert(posts).values({
      //   name: input.name,
      // });
    }),

  getLatest: publicProcedure.query(() => {
    return []
    // return ctx.db.query.posts.findFirst({
    //   orderBy: (posts, { desc }) => [desc(posts.createdAt)],
    // });
  }),
});
