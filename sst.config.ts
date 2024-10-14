/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
    app(input) {
        return {
            name: "deskribe",
            removal: input?.stage === "production" ? "retain" : "remove",
            home: "aws",
            providers: {
                aws: {
                    profile:
                        input.stage === "prod"
                            ? "deskribe-prod"
                            : "deskribe-dev",
                },
            },
        };
    },
    async run() {
        let domain: string;
        if ($app.stage == "prod") {
            domain = "deskribe.cc";
        } else if ($app.stage == "dev") {
            domain = "dev.deskribe.cc";
        } else {
            domain = $app.stage + ".dev.deskribe.cc"
        }

        const desk = new sst.aws.Nextjs("desk", {
            path: "app/desk",
            domain: "desk." + domain,
            dev: {
                command: "bun dev",
            }
        })

        const deskStatic = new sst.aws.StaticSite("desk-static", {
            path: "app/desk-tstack",
            domain: "desk-static." + domain,
            dev: {
                command: "bun dev",
            }
        })

        const landing = new sst.aws.Astro("landing", {
            path: "app/landing",
            domain: domain,
            dev: {
                command: "bun dev",
            }
        })
    },
});
