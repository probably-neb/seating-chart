import React from "react";

const ANIMATION_INTERVAL = 2000;

export default function SeatingChartAnimation() {
    const [animationStep, setAnimationStep] = React.useState(0);

    React.useEffect(() => {
        const interval = setInterval(() => {
            setAnimationStep((prev) => (prev + 1) % 4);
        }, ANIMATION_INTERVAL);
        return () => clearInterval(interval);
    }, []);

    return (
        <>
            <div
                className={`absolute inset-0 transition-opacity duration-500 ${animationStep === 0 ? "opacity-100" : "opacity-0"}`}
            >
                <svg viewBox="0 0 100 100" className="w-full h-full">
                    <rect
                        x="10"
                        y="10"
                        width="80"
                        height="80"
                        fill="#f0f0f0"
                        stroke="#000"
                        strokeWidth="2"
                    />
                    <text
                        x="50"
                        y="50"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize="14"
                    >
                        Empty Chart
                    </text>
                </svg>
            </div>
            <div
                className={`absolute inset-0 transition-opacity duration-500 ${animationStep === 1 ? "opacity-100" : "opacity-0"}`}
            >
                <svg viewBox="0 0 100 100" className="w-full h-full">
                    <rect
                        x="10"
                        y="10"
                        width="80"
                        height="80"
                        fill="#f0f0f0"
                        stroke="#000"
                        strokeWidth="2"
                    />
                    <circle cx="30" cy="30" r="5" fill="#ff0000" />
                    <circle cx="50" cy="30" r="5" fill="#00ff00" />
                    <circle cx="70" cy="30" r="5" fill="#0000ff" />
                </svg>
            </div>
            <div
                className={`absolute inset-0 transition-opacity duration-500 ${animationStep === 2 ? "opacity-100" : "opacity-0"}`}
            >
                <svg viewBox="0 0 100 100" className="w-full h-full">
                    <rect
                        x="10"
                        y="10"
                        width="80"
                        height="80"
                        fill="#f0f0f0"
                        stroke="#000"
                        strokeWidth="2"
                    />
                    <circle cx="30" cy="30" r="5" fill="#ff0000" />
                    <circle cx="50" cy="30" r="5" fill="#00ff00" />
                    <circle cx="70" cy="30" r="5" fill="#0000ff" />
                    <circle cx="30" cy="50" r="5" fill="#ffff00" />
                    <circle cx="50" cy="50" r="5" fill="#ff00ff" />
                    <circle cx="70" cy="50" r="5" fill="#00ffff" />
                </svg>
            </div>
            <div
                className={`absolute inset-0 transition-opacity duration-500 ${animationStep === 3 ? "opacity-100" : "opacity-0"}`}
            >
                <svg viewBox="0 0 100 100" className="w-full h-full">
                    <rect
                        x="10"
                        y="10"
                        width="80"
                        height="80"
                        fill="#f0f0f0"
                        stroke="#000"
                        strokeWidth="2"
                    />
                    <circle cx="30" cy="30" r="5" fill="#ff0000" />
                    <circle cx="50" cy="30" r="5" fill="#00ff00" />
                    <circle cx="70" cy="30" r="5" fill="#0000ff" />
                    <circle cx="30" cy="50" r="5" fill="#ffff00" />
                    <circle cx="50" cy="50" r="5" fill="#ff00ff" />
                    <circle cx="70" cy="50" r="5" fill="#00ffff" />
                    <circle cx="30" cy="70" r="5" fill="#800000" />
                    <circle cx="50" cy="70" r="5" fill="#008000" />
                    <circle cx="70" cy="70" r="5" fill="#000080" />
                </svg>
            </div>
        </>
    );
}
