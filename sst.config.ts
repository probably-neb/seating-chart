/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
    app(input) {
        return {
            name: "deskribe",
            removal: input?.stage === "prod" ? "retain" : "remove",
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

        const desk = new sst.aws.Astro("desk", {
            path: "app/desk",
            domain: "seating." + domain,
            dev: {
                command: "bun dev",
                // url: "http://localhost:3001",
            }
        })

        const landing = new sst.aws.Astro("landing", {
            path: "app/landing",
            domain: domain,
            link: [desk],
            dev: {
                command: "bun dev",
            }
        })
    },
});
