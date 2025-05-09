import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const HomePage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80 py-12 px-4 md:px-6 lg:px-8 space-y-16">
      <section className="text-center py-16 animate-fade-in">
        <h1 className="text-4xl md:text-5xl font-heading font-bold tracking-tight text-foreground mb-6">
          Welcome to the Premier Presale DApp
        </h1>
        <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
          Discover, participate in, or launch your own token presales securely
          and transparently on the blockchain.
        </p>
        <div className="flex justify-center gap-4">
          <Button
            asChild
            size="lg"
            className="bg-gradient-to-r from-primary-900 to-primary-800 text-white text-lg py-6 px-8 hover:from-primary-800 hover:to-primary-700"
          >
            <Link to="/presales">Explore Presales</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="border-primary-900 text-primary-900 text-lg py-6 px-8 hover:bg-primary-50 hover:text-primary-800"
          >
            <Link to="/create">Create Your Own</Link>
          </Button>
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-8 items-center max-w-6xl mx-auto">
        <div className="space-y-6 animate-slide-up">
          <h2 className="text-3xl md:text-4xl font-heading font-semibold text-foreground">
            For Investors
          </h2>
          <p className="text-lg text-muted-foreground">
            Get early access to promising new projects. Browse a curated list of
            upcoming token presales, review project details, and participate
            with confidence using our secure platform. Track your investments
            and manage your portfolio easily.
          </p>
          <Button
            asChild
            variant="secondary"
            className="bg-primary-50 text-primary-900 hover:bg-primary-100 text-base px-6 py-3"
          >
            <Link to="/presales">Browse Active Presales</Link>
          </Button>
        </div>
        <div className="bg-gradient-to-br from-primary-50 to-muted rounded-lg h-64 md:h-80 flex items-center justify-center text-muted-foreground shadow-card">
          <span className="text-lg font-medium text-primary-900/70">
            [Illustration: Investor finding gems]
          </span>
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-8 items-center max-w-6xl mx-auto">
        <div className="bg-gradient-to-br from-primary-50 to-muted rounded-lg h-64 md:h-80 flex items-center justify-center text-muted-foreground shadow-card order-last md:order-first">
          <span className="text-lg font-medium text-primary-900/70">
            [Illustration: Project launching rocket]
          </span>
        </div>
        <div className="space-y-6 animate-slide-up">
          <h2 className="text-3xl md:text-4xl font-heading font-semibold text-foreground">
            For Project Creators
          </h2>
          <p className="text-lg text-muted-foreground">
            Launch your project successfully with our easy-to-use presale
            creation tools. Define your tokenomics, set your goals, and reach a
            wide audience of potential investors. Benefit from automated vesting
            schedules and liquidity locking options.
          </p>
          <Button
            asChild
            variant="secondary"
            className="bg-primary-50 text-primary-900 hover:bg-primary-100 text-base px-6 py-3"
          >
            <Link to="/create">Start Your Presale</Link>
          </Button>
        </div>
      </section>

      <section className="text-center py-16 animate-fade-in">
        <h2 className="text-3xl md:text-4xl font-heading font-semibold text-foreground mb-6">
          Secure & Transparent
        </h2>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Built on decentralized technology, our platform ensures fairness and
          security. All presale contracts are verifiable on the blockchain,
          providing transparency for both investors and creators.
        </p>
      </section>
    </div>
  );
};

export default HomePage;
