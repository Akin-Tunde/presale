import { useState, useEffect } from "react";

interface MousePosition {
  x: number;
  y: number;
}

interface FloatingOrbProps {
  size: string;
  color: string;
  position: { top: string; left: string };
  delay: string;
}

const HomePage = () => {
  const [mousePosition, setMousePosition] = useState<MousePosition>({
    x: 0,
    y: 0,
  });
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const ParticleField = () => (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(80)].map((_, i) => (
        <div
          key={i}
          className="absolute w-0.5 h-0.5 sm:w-1 sm:h-1 bg-gradient-to-r from-emerald-400 to-green-300 rounded-full opacity-30 animate-pulse"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 4}s`,
            animationDuration: `${2 + Math.random() * 4}s`,
          }}
        />
      ))}
    </div>
  );

  const FloatingOrb = ({ size, color, position, delay }: FloatingOrbProps) => (
    <div
      className={`absolute ${size} ${color} rounded-full blur-2xl opacity-20 animate-pulse`}
      style={{
        ...position,
        animationDelay: delay,
        animationDuration: "6s",
        transform: `translate(${mousePosition.x * 0.03}px, ${
          mousePosition.y * 0.03
        }px)`,
      }}
    />
  );

  const GlowingGrid = () => (
    <div className="absolute inset-0 opacity-10">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
          linear-gradient(rgba(34, 197, 94, 0.1) 1px, transparent 1px),
          linear-gradient(90deg, rgba(34, 197, 94, 0.1) 1px, transparent 1px)
        `,
          backgroundSize: "20px 20px sm:40px 40px",
        }}
      />
    </div>
  );

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-950 via-green-950 to-emerald-950 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/30 via-slate-950 to-black" />

      <GlowingGrid />

      <FloatingOrb
        size="w-[200px] h-[200px] sm:w-[500px] sm:h-[500px]"
        color="bg-gradient-to-r from-emerald-500 via-green-400 to-teal-500"
        position={{ top: "5%", left: "75%" }}
        delay="0s"
      />
      <FloatingOrb
        size="w-40 h-40 sm:w-96 sm:h-96"
        color="bg-gradient-to-r from-green-400 to-emerald-300"
        position={{ top: "50%", left: "5%" }}
        delay="1.5s"
      />
      <FloatingOrb
        size="w-32 h-32 sm:w-80 sm:h-80"
        color="bg-gradient-to-r from-teal-500 to-cyan-400"
        position={{ top: "70%", left: "80%" }}
        delay="3s"
      />
      <FloatingOrb
        size="w-28 h-28 sm:w-72 sm:h-72"
        color="bg-gradient-to-r from-lime-400 to-green-500"
        position={{ top: "20%", left: "20%" }}
        delay="4.5s"
      />

      <ParticleField />

      <div className="absolute inset-0 pointer-events-none">
        {[...Array(12)].map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 sm:w-3 sm:h-3 border border-emerald-400/20 rotate-45 animate-spin"
            style={{
              left: `${10 + ((i * 8) % 80)}%`,
              top: `${15 + ((i * 12) % 70)}%`,
              animationDuration: `${8 + i * 2}s`,
              animationDelay: `${i * 0.5}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-16 sm:space-y-32">
        <section className="text-center py-12 sm:py-24 relative">
          <div
            className="absolute inset-0 bg-gradient-to-r from-emerald-600/15 to-green-600/15 rounded-3xl sm:rounded-[3rem] blur-2xl sm:blur-3xl"
            style={{
              transform: `translateY(${scrollY * 0.1}px) scale(${
                1 + scrollY * 0.0001
              })`,
            }}
          />

          <div className="relative backdrop-blur-xl bg-white/10 border-2 border-emerald-400/20 rounded-2xl sm:rounded-[3rem] p-8 sm:p-16 mx-auto max-w-4xl sm:max-w-5xl shadow-2xl shadow-emerald-500/10">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 via-transparent to-green-500/10 rounded-2xl sm:rounded-[3rem] animate-pulse" />

            <div className="absolute -top-2 -left-2 w-6 h-6 sm:-top-4 sm:-left-4 sm:w-8 sm:h-8 bg-gradient-to-r from-emerald-400 to-green-400 rounded-full animate-bounce opacity-80" />
            <div
              className="absolute -top-1 -right-4 w-4 h-4 sm:-top-2 sm:-right-8 sm:w-6 sm:h-6 bg-gradient-to-r from-green-400 to-teal-400 rounded-full animate-bounce opacity-60"
              style={{ animationDelay: "0.5s" }}
            />
            <div
              className="absolute -bottom-3 -left-4 w-8 h-8 sm:-bottom-6 sm:-left-8 sm:w-10 sm:h-10 bg-gradient-to-r from-teal-400 to-emerald-400 rounded-full animate-bounce opacity-70"
              style={{ animationDelay: "1s" }}
            />

            <h1 className="relative text-4xl sm:text-6xl md:text-8xl font-black bg-gradient-to-r from-white via-emerald-100 to-green-100 bg-clip-text text-transparent mb-6 sm:mb-10 leading-tight">
              Welcome to the
              <br />
              <span className="bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400 bg-clip-text text-transparent animate-pulse">
                Premier Presale DApp
              </span>
            </h1>

            <p className="text-lg sm:text-2xl md:text-3xl text-emerald-100/90 mb-8 sm:mb-16 max-w-3xl sm:max-w-4xl mx-auto leading-relaxed">
              Discover, participate in, or launch your own token presales
              <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-green-300 to-emerald-300 bg-clip-text text-transparent font-semibold">
                securely and transparently
              </span>{" "}
              on the blockchain.
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4 sm:gap-8">
              <a
                href="/presales"
                className="group relative bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 hover:from-emerald-500 hover:via-green-500 hover:to-teal-500 text-white text-base sm:text-xl font-semibold py-4 sm:py-8 px-8 sm:px-16 rounded-xl sm:rounded-2xl shadow-2xl hover:shadow-emerald-500/30 transition-all duration-700 transform hover:scale-105 border-0 overflow-hidden inline-block"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-white/20 via-emerald-200/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                <span className="relative z-10 flex items-center justify-center">
                  Explore Presales
                  <span className="ml-2 sm:ml-3 text-lg sm:text-xl group-hover:translate-x-2 transition-transform duration-500">
                    💎
                  </span>
                </span>
              </a>

              <a
                href="/create"
                className="group bg-transparent backdrop-blur-sm border-2 sm:border-3 border-emerald-400/60 text-emerald-100 hover:bg-emerald-500/20 hover:border-emerald-300 hover:text-white text-base sm:text-xl font-semibold py-4 sm:py-8 px-8 sm:px-16 rounded-xl sm:rounded-2xl shadow-2xl hover:shadow-emerald-400/30 transition-all duration-700 transform hover:scale-105 inline-block"
              >
                <span className="flex items-center justify-center">
                  Create Your Own
                  <span className="ml-2 sm:ml-3 text-lg sm:text-xl group-hover:rotate-180 transition-transform duration-700">
                    🚀
                  </span>
                </span>
              </a>
            </div>
          </div>
        </section>

        <section className="max-w-6xl sm:max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-20 items-center">
          <div className="group relative">
            <div className="absolute -inset-2 sm:-inset-4 bg-gradient-to-r from-emerald-500/20 to-green-500/20 rounded-2xl sm:rounded-[2.5rem] blur-xl sm:blur-2xl group-hover:blur-3xl transition-all duration-1000" />

            <div className="relative backdrop-blur-xl bg-white/10 border-2 border-emerald-400/20 rounded-2xl sm:rounded-[2.5rem] p-8 sm:p-12 hover:bg-white/15 transition-all duration-1000 transform hover:scale-105 shadow-2xl hover:shadow-emerald-500/25">
              <div className="space-y-6 sm:space-y-10">
                <div className="flex items-center space-x-4 sm:space-x-6">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-r from-emerald-400 to-green-400 rounded-2xl sm:rounded-3xl flex items-center justify-center shadow-xl shadow-emerald-500/20">
                    <span className="text-2xl sm:text-3xl">💎</span>
                  </div>
                  <h2 className="text-3xl sm:text-5xl md:text-6xl font-black bg-gradient-to-r from-emerald-300 to-green-300 bg-clip-text text-transparent">
                    For Investors
                  </h2>
                </div>

                <p className="text-base sm:text-xl text-emerald-100/80 leading-relaxed">
                  Get early access to promising new projects. Browse a curated
                  list of upcoming token presales, review project details, and
                  participate with confidence using our secure platform. Track
                  your investments and manage your portfolio easily.
                </p>

                <div className="flex flex-wrap gap-3 sm:gap-4 mb-6 sm:mb-10">
                  {[
                    "Early Access",
                    "Risk Analysis",
                    "Portfolio Tracking",
                    "Smart Alerts",
                  ].map((feature) => (
                    <span
                      key={feature}
                      className="px-4 sm:px-6 py-2 sm:py-3 bg-emerald-500/20 border-2 border-emerald-400/30 rounded-xl sm:rounded-2xl text-emerald-200 font-semibold backdrop-blur-sm text-sm sm:text-base"
                    >
                      {feature}
                    </span>
                  ))}
                </div>

                <a
                  href="/presales"
                  className="block w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white py-4 sm:py-6 rounded-xl sm:rounded-2xl shadow-xl hover:shadow-emerald-500/30 transition-all duration-500 group border-0 text-center font-semibold text-base sm:text-lg"
                >
                  Browse Active Presales
                  <span className="ml-2 group-hover:translate-x-2 transition-transform duration-500 inline-block">
                    →
                  </span>
                </a>
              </div>
            </div>
          </div>

          <div className="relative h-[300px] sm:h-[500px] group">
            <div className="absolute -inset-2 sm:-inset-4 bg-gradient-to-br from-emerald-500/30 to-green-500/30 rounded-2xl sm:rounded-[2.5rem] blur-2xl sm:blur-3xl group-hover:blur-[4rem] transition-all duration-1000" />

            <div className="relative h-full backdrop-blur-xl bg-white/10 border-2 border-emerald-400/20 rounded-2xl sm:rounded-[2.5rem] overflow-hidden shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/15 to-green-500/15" />

              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-48 sm:w-64 h-48 sm:h-64">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="absolute border-2 border-emerald-400/30 rounded-full animate-ping"
                      style={{
                        width: `${60 + i * 30}px`,
                        height: `${60 + i * 30}px`,
                        left: `${50 - (30 + i * 15)}px`,
                        top: `${50 - (30 + i * 15)}px`,
                        animationDelay: `${i * 0.8}s`,
                        animationDuration: "4s",
                      }}
                    />
                  ))}

                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="absolute w-3 h-3 sm:w-4 sm:h-4 bg-gradient-to-r from-emerald-400 to-green-400 rounded-full animate-bounce shadow-lg"
                      style={{
                        top: `${20 + Math.sin(i) * 40}%`,
                        left: `${30 + i * 15}%`,
                        animationDelay: `${i * 0.3}s`,
                        animationDuration: "2s",
                      }}
                    />
                  ))}

                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center backdrop-blur-sm bg-white/10 rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-emerald-400/20">
                      <div className="text-3xl sm:text-5xl mb-2 sm:mb-3">
                        📈
                      </div>
                      <div className="text-emerald-300 font-bold text-sm sm:text-lg">
                        Smart Investing
                      </div>
                      <div className="text-green-200 text-xs sm:text-sm">
                        AI-Powered Analysis
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative h-[300px] sm:h-[500px] group lg:order-first">
            <div className="absolute -inset-2 sm:-inset-4 bg-gradient-to-br from-green-500/30 to-teal-500/30 rounded-2xl sm:rounded-[2.5rem] blur-2xl sm:blur-3xl group-hover:blur-[4rem] transition-all duration-1000" />

            <div className="relative h-full backdrop-blur-xl bg-white/10 border-2 border-green-400/20 rounded-2xl sm:rounded-[2.5rem] overflow-hidden shadow-2xl">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/15 to-teal-500/15" />

              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <div
                    className="text-6xl sm:text-9xl animate-bounce filter drop-shadow-2xl"
                    style={{ animationDuration: "3s" }}
                  >
                    🚀
                  </div>

                  {[...Array(15)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute rounded-full animate-pulse"
                      style={{
                        width: `${6 - i * 0.3}px`,
                        height: `${6 - i * 0.3}px`,
                        background: `linear-gradient(45deg, 
                          ${
                            i % 3 === 0
                              ? "#10b981"
                              : i % 3 === 1
                              ? "#22c55e"
                              : "#06d6a0"
                          }, 
                          ${
                            i % 3 === 0
                              ? "#22c55e"
                              : i % 3 === 1
                              ? "#06d6a0"
                              : "#f59e0b"
                          })`,
                        bottom: `${-12 - i * 10}px`,
                        left: `${42 + Math.sin(i * 0.5) * 12}px`,
                        animationDelay: `${i * 0.15}s`,
                        opacity: 1 - i * 0.06,
                        boxShadow: "0 0 8px rgba(16, 185, 129, 0.5)",
                      }}
                    />
                  ))}

                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="absolute border-2 border-green-400/40 rounded-full animate-ping"
                      style={{
                        width: `${90 + i * 30}px`,
                        height: `${90 + i * 30}px`,
                        left: `${-45 - i * 15}px`,
                        top: `${-45 - i * 15}px`,
                        animationDelay: `${i * 0.5}s`,
                        animationDuration: "2s",
                      }}
                    />
                  ))}

                  <div className="absolute -bottom-16 sm:-bottom-24 left-1/2 transform -translate-x-1/2 text-center backdrop-blur-sm bg-white/10 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-green-400/20">
                    <div className="text-green-300 font-bold text-sm sm:text-lg">
                      Launch Success
                    </div>
                    <div className="text-teal-200 text-xs sm:text-sm">
                      Ready for Takeoff
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="group relative">
            <div className="absolute -inset-2 sm:-inset-4 bg-gradient-to-r from-green-500/20 to-teal-500/20 rounded-2xl sm:rounded-[2.5rem] blur-xl sm:blur-2xl group-hover:blur-3xl transition-all duration-1000" />

            <div className="relative backdrop-blur-xl bg-white/10 border-2 border-green-400/20 rounded-2xl sm:rounded-[2.5rem] p-8 sm:p-12 hover:bg-white/15 transition-all duration-1000 transform hover:scale-105 shadow-2xl hover:shadow-green-500/25">
              <div className="space-y-6 sm:space-y-10">
                <div className="flex items-center space-x-4 sm:space-x-6">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-r from-green-400 to-teal-400 rounded-2xl sm:rounded-3xl flex items-center justify-center shadow-xl shadow-green-500/20">
                    <span className="text-2xl sm:text-3xl">🚀</span>
                  </div>
                  <h2 className="text-3xl sm:text-5xl md:text-6xl font-black bg-gradient-to-r from-green-300 to-teal-300 bg-clip-text text-transparent">
                    For Project Creators
                  </h2>
                </div>

                <p className="text-base sm:text-xl text-green-100/80 leading-relaxed">
                  Launch your project successfully with our easy-to-use presale
                  creation tools. Define your tokenomics, set your goals, and
                  reach a wide audience of potential investors. Benefit from
                  automated vesting schedules and liquidity locking options.
                </p>

                <div className="flex flex-wrap gap-3 sm:gap-4 mb-6 sm:mb-10">
                  {[
                    "Easy Setup",
                    "Smart Contracts",
                    "Marketing Tools",
                    "Liquidity Lock",
                  ].map((feature) => (
                    <span
                      key={feature}
                      className="px-4 sm:px-6 py-2 sm:py-3 bg-green-500/20 border-2 border-green-400/30 rounded-xl sm:rounded-2xl text-green-200 font-semibold backdrop-blur-sm text-sm sm:text-base"
                    >
                      {feature}
                    </span>
                  ))}
                </div>

                <a
                  href="/create"
                  className="block w-full bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-500 hover:to-teal-500 text-white py-4 sm:py-6 rounded-xl sm:rounded-2xl shadow-xl hover:shadow-green-500/30 transition-all duration-500 group border-0 text-center font-semibold text-base sm:text-lg"
                >
                  Start Your Presale
                  <span className="ml-2 group-hover:rotate-45 transition-transform duration-500 inline-block">
                    ✦
                  </span>
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="text-center py-12 sm:py-24 relative max-w-5xl sm:max-w-6xl mx-auto">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/15 to-green-500/15 rounded-2xl sm:rounded-[3rem] blur-2xl sm:blur-3xl" />

          <div className="relative backdrop-blur-xl bg-white/10 border-2 border-emerald-400/20 rounded-2xl sm:rounded-[3rem] p-8 sm:p-16 shadow-2xl">
            <div className="mb-8 sm:mb-12">
              <div className="inline-flex items-center justify-center w-16 h-16 sm:w-24 sm:h-24 bg-gradient-to-r from-emerald-400 to-green-400 rounded-xl sm:rounded-[2rem] mb-6 sm:mb-8 shadow-2xl shadow-emerald-500/20">
                <span className="text-2xl sm:text-4xl">🛡️</span>
              </div>

              <h2 className="text-4xl sm:text-5xl md:text-7xl font-black bg-gradient-to-r from-emerald-300 via-green-300 to-teal-300 bg-clip-text text-transparent mb-6 sm:mb-10">
                Secure & Transparent
              </h2>
            </div>

            <p className="text-lg sm:text-2xl md:text-3xl text-emerald-100/80 max-w-3xl sm:max-w-4xl mx-auto leading-relaxed mb-8 sm:mb-16">
              Built on decentralized technology, our platform ensures fairness
              and security. All presale contracts are verifiable on the
              blockchain, providing transparency for both investors and
              creators.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-10">
              {[
                {
                  icon: "🔐",
                  title: "Smart Contracts",
                  desc: "Audited & Verified",
                  color: "from-emerald-400 to-green-400",
                },
                {
                  icon: "🌐",
                  title: "Blockchain Native",
                  desc: "Fully Decentralized",
                  color: "from-green-400 to-teal-400",
                },
                {
                  icon: "⚡",
                  title: "Lightning Fast",
                  desc: "Instant Settlements",
                  color: "from-teal-400 to-cyan-400",
                },
              ].map((item, i) => (
                <div key={i} className="group relative">
                  <div className="backdrop-blur-sm bg-white/5 border border-emerald-400/20 rounded-2xl sm:rounded-3xl p-6 sm:p-8 hover:bg-white/10 transition-all duration-500 transform hover:scale-105">
                    <div
                      className={`w-12 h-12 sm:w-16 sm:h-16 bg-gradient-to-r ${item.color} rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 shadow-lg group-hover:scale-110 transition-transform duration-500`}
                    >
                      <span className="text-xl sm:text-2xl">{item.icon}</span>
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold text-white mb-2 sm:mb-3">
                      {" "}
                      {item.title}
                    </h3>
                    <p className="text-emerald-200/80 text-sm sm:text-lg">
                      {item.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-50">
        <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white/10 backdrop-blur-sm border-2 border-emerald-400/30 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-2xl shadow-emerald-500/20 hover:scale-110 transition-transform duration-300">
          <div className="w-1.5 h-6 sm:w-2 sm:h-8 bg-gradient-to-b from-emerald-400 via-green-400 to-transparent rounded-full animate-pulse" />
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          @keyframes slide-up {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          
          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-15px); }
          }
          
          .animate-fade-in {
            animation: fade-in 1s ease-out;
          }
          
          .animate-slide-up {
            animation: slide-up 0.8s ease-out 0.2s both;
          }
          
          .animate-float {
            animation: float 5s ease-in-out infinite;
          }
        `,
        }}
      />
    </div>
  );
};

export default HomePage;
