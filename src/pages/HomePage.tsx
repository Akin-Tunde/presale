import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const HomePage = () => {
  return (
    <div className="space-y-8">
      <section className="text-center py-12">
        <h1 className="text-4xl font-bold tracking-tight lg:text-5xl mb-4">
          Welcome to the Premier Presale DApp
        </h1>
        <p className="text-xl text-muted-foreground mb-8">
          Discover, participate in, or launch your own token presales securely and transparently on the blockchain.
        </p>
        <div className="flex justify-center gap-4">
          <Button asChild size="lg">
            <Link to="/presales">Explore Presales</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/create">Create Your Own</Link>
          </Button>
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-8 items-center">
        <div>
          <h2 className="text-3xl font-semibold mb-4">For Investors</h2>
          <p className="text-muted-foreground mb-4">
            Get early access to promising new projects. Browse a curated list of upcoming token presales, review project details, and participate with confidence using our secure platform. Track your investments and manage your portfolio easily.
          </p>
          <Button asChild variant="secondary">
            <Link to="/presales">Browse Active Presales</Link>
          </Button>
        </div>
        {/* Placeholder for an image or illustration */}
        <div className="bg-muted rounded-lg h-64 flex items-center justify-center text-muted-foreground">
          [Illustration: Investor finding gems]
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-8 items-center">
        {/* Placeholder for an image or illustration */}
        <div className="bg-muted rounded-lg h-64 flex items-center justify-center text-muted-foreground order-last md:order-first">
          [Illustration: Project launching rocket]
        </div>
        <div>
          <h2 className="text-3xl font-semibold mb-4">For Project Creators</h2>
          <p className="text-muted-foreground mb-4">
            Launch your project successfully with our easy-to-use presale creation tools. Define your tokenomics, set your goals, and reach a wide audience of potential investors. Benefit from automated vesting schedules and liquidity locking options.
          </p>
          <Button asChild variant="secondary">
            <Link to="/create">Start Your Presale</Link>
          </Button>
        </div>
      </section>

      <section className="text-center py-12">
        <h2 className="text-3xl font-semibold mb-4">Secure & Transparent</h2>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Built on decentralized technology, our platform ensures fairness and security. All presale contracts are verifiable on the blockchain, providing transparency for both investors and creators.
        </p>
      </section>
    </div>
  );
};

export default HomePage;

