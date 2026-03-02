import Header from '../components/layout/Header';
import HeroSection from '../components/Home/HeroSection';
import HowItWorks from '../components/Home/HowItWorks';


const Index = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1"> 
        <HeroSection />
        <HowItWorks />
      </main>
    </div>
  );
};

export default Index;