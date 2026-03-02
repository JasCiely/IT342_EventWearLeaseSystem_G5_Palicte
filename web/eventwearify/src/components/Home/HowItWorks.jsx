import React from 'react';
import '../css/Home/HowItWorks.css';
import { Search, Calendar, PackageCheck, RotateCcw } from 'lucide-react';

const HowItWorks = () => {
  const steps = [
    {
      id: 1,
      title: "Browse & Choose",
      description: "Explore our collection of premium formal wear and find your perfect outfit.",
      icon: <Search size={24} />,
    },
    {
      id: 2,
      title: "Select Your Date",
      description: "Pick your event date and rental duration. We'll hold the outfit just for you.",
      icon: <Calendar size={24} />,
    },
    {
      id: 3,
      title: "Receive & Wear",
      description: "Get your outfit delivered fresh and pressed, ready to make you shine.",
      icon: <PackageCheck size={24} />,
    },
    {
      id: 4,
      title: "Return Easily",
      description: "After your event, simply return the outfit. We handle the cleaning!",
      icon: <RotateCcw size={24} />,
    }
  ];

  return (
    <section className="how-section">
      <div className="how-header">
        <h2 className="how-title">How It Works</h2>
        <p className="how-subtitle">
          Renting formal wear has never been easier. Follow these simple steps to look stunning at your next event.
        </p>
      </div>

      <div className="steps-container">
        {/* The horizontal connecting line */}
        <div className="timeline-line"></div>
        
        <div className="steps-grid">
          {steps.map((step) => (
            <div key={step.id} className="step-card">
              <div className="icon-wrapper">
                <div className="step-number">{step.id}</div>
                <div className="main-icon">{step.icon}</div>
              </div>
              <h3 className="step-title">{step.title}</h3>
              <p className="step-description">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;