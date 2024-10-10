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
    async run() {},
});
