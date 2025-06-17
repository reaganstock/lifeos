import React, { useState, useEffect } from 'react';
import { 
  Play, 
  ArrowRight, 
  Code, 
  Terminal, 
  Command, 
  Zap, 
  Target, 
  Calendar, 
  CheckSquare, 
  FileText, 
  Repeat, 
  Brain, 
  Mic, 
  Eye, 
  ChevronRight,
  Star,
  TrendingUp,
  Circle,
  Check,
  Clock,
  DollarSign,
  Users,
  Rocket,
  BarChart3,
  Globe,
  Phone,
  MessageSquare,
  Sparkles,
  Flame
} from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ 
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100
      });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Tesla-style ambient lighting */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-30"
        style={{
          background: `radial-gradient(800px circle at ${mousePosition.x}% ${mousePosition.y}%, rgba(59, 130, 246, 0.15), transparent 50%)`
        }}
      />

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 px-8 py-6 bg-black/20 backdrop-blur-xl border-b border-white/10">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-lg flex items-center justify-center">
              <Code className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">Lifesurf</span>
          </div>
          <div className="flex items-center space-x-6">
            <span className="text-sm text-gray-400">🔴 Live Dashboard</span>
            <button 
              onClick={onGetStarted}
              className="px-6 py-2 bg-white text-black rounded-lg font-medium hover:bg-gray-100 transition-all duration-200"
            >
              Launch App
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center pt-20">
        <div className={`max-w-6xl mx-auto text-center px-8 transition-all duration-1000 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}>
          
          {/* Status indicator */}
          <div className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-500/20 rounded-full backdrop-blur-xl border border-emerald-500/30 mb-8">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">Live System Operating</span>
          </div>

          <h1 className="text-7xl md:text-8xl font-black mb-8 tracking-tight">
            <span className="block">The Only</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400">
              Life OS
            </span>
            <span className="block">That Works</span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-4xl mx-auto leading-relaxed">
            Watch a Georgetown student manage $100K+ revenue goals, daily Mass, Olympic-level fitness, 
            and Catholic devotion through <strong>pure natural language</strong>.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-16">
            <button 
              onClick={onGetStarted}
              className="group px-10 py-4 bg-gradient-to-r from-blue-500 to-cyan-400 text-white rounded-xl font-semibold text-lg hover:from-blue-600 hover:to-cyan-500 transition-all duration-200 flex items-center space-x-3 shadow-2xl"
            >
              <span>Launch Dashboard</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            
            <button className="px-10 py-4 border border-white/30 rounded-xl font-semibold text-lg hover:bg-white/10 transition-all duration-200 flex items-center space-x-3">
              <Play className="w-5 h-5" />
              <span>Watch Demo</span>
            </button>
          </div>

          {/* Live metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            {[
              { label: "Current Streak", value: "47 days", icon: Flame, color: "from-orange-500 to-red-500" },
              { label: "Goals Progress", value: "87%", icon: Target, color: "from-green-500 to-emerald-500" },
              { label: "Revenue Goal", value: "$5K/mo", icon: DollarSign, color: "from-blue-500 to-cyan-500" },
              { label: "AI Commands", value: "2,847", icon: Zap, color: "from-purple-500 to-pink-500" }
            ].map((metric, index) => (
              <div key={index} className="bg-white/5 rounded-xl p-4 border border-white/10 backdrop-blur-xl">
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-r ${metric.color} flex items-center justify-center mb-3`}>
                  <metric.icon className="w-4 h-4 text-white" />
                </div>
                <div className="text-2xl font-bold mb-1">{metric.value}</div>
                <div className="text-sm text-gray-400">{metric.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Voice Command Demo */}
      <section className="py-24 px-8 bg-gradient-to-b from-transparent to-blue-950/20">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-5xl md:text-6xl font-bold mb-8">
              Watch Real Commands
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              This Georgetown student runs his entire life through voice commands. 
              Every goal, habit, and spiritual practice controlled by AI.
            </p>
          </div>

          {/* Voice command examples */}
          <div className="grid md:grid-cols-2 gap-8 mb-16">
            <div className="bg-gradient-to-br from-gray-900/80 to-black/80 rounded-3xl border border-white/10 backdrop-blur-xl p-8">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-green-400 rounded-full flex items-center justify-center mr-4">
                  <Mic className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="font-semibold">Voice Command</div>
                  <div className="text-sm text-gray-400">Student speaking</div>
                </div>
              </div>
              
              <div className="bg-black/40 rounded-xl p-6 mb-6">
                <div className="text-emerald-400 text-sm mb-2">🎤 Student:</div>
                <div className="text-lg mb-4">"Add handstand push-up practice to my gym routine. Make it priority 1 since I need to master this for my fitness goals."</div>
                
                <div className="text-blue-400 text-sm mb-2">🤖 AI Response:</div>
                <div className="text-gray-300 space-y-1">
                  <div>✓ Added to Gym/Calisthenics category</div>
                  <div>✓ Set as high priority</div>
                  <div>✓ Linked to One-arm pull-up goal</div>
                  <div>✓ Scheduled in tomorrow's routine</div>
                </div>
              </div>
              
              <div className="text-xs text-gray-500">
                Executed in 0.8 seconds • Modified 3 items • Updated calendar
              </div>
            </div>

            <div className="bg-gradient-to-br from-gray-900/80 to-black/80 rounded-3xl border border-white/10 backdrop-blur-xl p-8">
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-400 rounded-full flex items-center justify-center mr-4">
                  <MessageSquare className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="font-semibold">Complex Command</div>
                  <div className="text-sm text-gray-400">Multi-category operation</div>
                </div>
              </div>
              
              <div className="bg-black/40 rounded-xl p-6 mb-6">
                <div className="text-emerald-400 text-sm mb-2">🎤 Student:</div>
                <div className="text-lg mb-4">"Block 2 hours tomorrow after Mass for app development. Link it to my $5K revenue goal and make sure it doesn't conflict with my St. Joseph prayer routine."</div>
                
                <div className="text-blue-400 text-sm mb-2">🤖 AI Response:</div>
                <div className="text-gray-300 space-y-1">
                  <div>✓ Created 8-10 PM development block</div>
                  <div>✓ Linked to "$5K/month" revenue goal</div>
                  <div>✓ Preserved 7 PM Mass schedule</div>
                  <div>✓ Protected 9:30 PM prayer time</div>
                  <div>✓ Added progress tracking</div>
                </div>
              </div>
              
              <div className="text-xs text-gray-500">
                Cross-referenced 4 categories • Updated goals, events, routines
              </div>
            </div>
          </div>

          {/* Real dashboard preview */}
          <div className="relative max-w-6xl mx-auto">
            <div className="bg-gradient-to-br from-gray-900/90 to-black/90 rounded-3xl border border-white/10 backdrop-blur-xl overflow-hidden shadow-2xl">
              
              {/* Browser header */}
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <div className="flex items-center space-x-4">
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  <span className="text-gray-400 text-sm">lifesurf.app/dashboard</span>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-emerald-400">94%</div>
                  <div className="text-sm text-gray-400">Life Execution Rate</div>
                </div>
              </div>

              {/* Dashboard grid */}
              <div className="grid grid-cols-12 gap-6 p-8">
                
                {/* Main metrics */}
                <div className="col-span-8 space-y-6">
                  
                  {/* Today's performance */}
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { category: "⚖️ Self-Regulation", progress: "92%", color: "emerald" },
                      { category: "🏋️ Gym Goals", progress: "88%", color: "blue" },
                      { category: "✝️ Catholic Practices", progress: "100%", color: "purple" }
                    ].map((item, i) => (
                      <div key={i} className="bg-white/5 rounded-xl p-4 border border-white/10">
                        <div className="text-sm text-gray-400 mb-2">{item.category}</div>
                        <div className="text-2xl font-bold text-emerald-400">{item.progress}</div>
                      </div>
                    ))}
                  </div>

                  {/* Live schedule */}
                  <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                    <h3 className="font-semibold mb-4 flex items-center">
                      <Clock className="w-5 h-5 mr-2 text-blue-400" />
                      Today's Schedule - Real Time
                    </h3>
                    <div className="space-y-3">
                      {[
                        { time: "5:00 AM", activity: "🌅 Morning Routine", status: "completed" },
                        { time: "6:00 AM", activity: "🏋️ Gym + Bible Reading", status: "completed" },
                        { time: "10:00 AM", activity: "📱 App Development", status: "active" },
                        { time: "7:00 PM", activity: "⛪ Daily Mass", status: "scheduled" },
                        { time: "8:00 PM", activity: "🙏 St. Joseph Prayer", status: "scheduled" }
                      ].map((item, i) => (
                        <div key={i} className={`p-3 rounded-lg flex items-center justify-between ${
                          item.status === 'active' ? 'bg-blue-500/20 border border-blue-500/30' : 
                          item.status === 'completed' ? 'bg-emerald-500/20 border border-emerald-500/30 opacity-75' :
                          'bg-white/5'
                        }`}>
                          <div className="flex items-center space-x-3">
                            <span className="font-mono text-sm text-gray-400">{item.time}</span>
                            <span>{item.activity}</span>
                          </div>
                          {item.status === 'active' && (
                            <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                          )}
                          {item.status === 'completed' && (
                            <Check className="w-4 h-4 text-emerald-400" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* AI Assistant */}
                <div className="col-span-4 bg-gradient-to-br from-purple-900/30 to-blue-900/30 rounded-xl p-6 border border-purple-500/30">
                  <div className="flex items-center mb-6">
                    <Brain className="w-6 h-6 text-purple-400 mr-3" />
                    <div>
                      <div className="font-semibold">Gemini Live AI</div>
                      <div className="text-xs text-gray-400">Voice + Text Ready</div>
                    </div>
                  </div>

                  <div className="bg-black/40 rounded-lg p-4 mb-4 max-h-48 overflow-y-auto">
                    <div className="space-y-3 text-sm">
                      <div>
                        <div className="text-purple-400 mb-1">You:</div>
                        <div>"How's my progress on becoming billionaire by 40?"</div>
                      </div>
                      <div>
                        <div className="text-blue-400 mb-1">AI:</div>
                        <div className="text-gray-300">
                          Your "Billionaire by 40" goal shows 12% progress. Revenue goal of $5K/month is at 76%. 
                          You're 22 years old, so you have 18 years. Current app development streak: 31 days. 
                          Want me to adjust your schedule for more revenue-focused tasks?
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <input 
                      type="text" 
                      placeholder="Command your life..."
                      className="flex-1 bg-black/40 border border-white/20 rounded-lg px-3 py-2 text-sm"
                    />
                    <button className="p-2 bg-purple-500 rounded-lg hover:bg-purple-600 transition-colors">
                      <Mic className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Live indicator */}
            <div className="absolute -top-4 -right-4 bg-red-500 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center">
              <div className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse"></div>
              LIVE
            </div>
          </div>
        </div>
      </section>

      {/* Market Validation */}
      <section className="py-24 px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-5xl md:text-6xl font-bold mb-8">
              The <span className="text-blue-400">$127B</span> Opportunity
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Productivity software market growing 14% annually. 
              But nobody has solved life management through natural language.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white/5 rounded-2xl p-8 border border-white/10 backdrop-blur-xl">
              <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl flex items-center justify-center mb-6">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Market Size</h3>
              <div className="text-4xl font-black text-red-400 mb-2">$127B</div>
              <p className="text-gray-400">
                Global productivity software market. 
                Current solutions are fragmented across 12+ apps.
              </p>
            </div>

            <div className="bg-white/5 rounded-2xl p-8 border border-white/10 backdrop-blur-xl">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center mb-6">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Target Users</h3>
              <div className="text-4xl font-black text-blue-400 mb-2">500M+</div>
              <p className="text-gray-400">
                High-achievers, entrepreneurs, students who think systematically. 
                Same people using Cursor, Notion, Linear.
              </p>
            </div>

            <div className="bg-white/5 rounded-2xl p-8 border border-white/10 backdrop-blur-xl">
              <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-green-500 rounded-xl flex items-center justify-center mb-6">
                <Rocket className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Competitive Edge</h3>
              <div className="text-4xl font-black text-emerald-400 mb-2">First</div>
              <p className="text-gray-400">
                First unified life OS with natural language control. 
                Voice commands for every life function.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-24 px-8 bg-gradient-to-b from-blue-950/20 to-transparent">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-8">
              Built by <span className="text-blue-400">systematic thinkers</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white/5 rounded-xl p-8 border border-white/10 backdrop-blur-xl">
              <div className="flex mb-6">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <blockquote className="text-xl text-gray-300 mb-6 leading-relaxed">
                "I was managing Georgetown apps across 8 different systems. 
                Now I just tell my phone 'schedule essay writing' and it handles everything. 
                This is how productivity should work."
              </blockquote>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mr-4">
                  <span className="text-white font-bold">M</span>
                </div>
                <div>
                  <div className="font-semibold">Marcus Chen</div>
                  <div className="text-sm text-gray-400">Georgetown Student, CS Major</div>
                </div>
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-8 border border-white/10 backdrop-blur-xl">
              <div className="flex mb-6">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <blockquote className="text-xl text-gray-300 mb-6 leading-relaxed">
                "Finally, someone built the operating system for ambitious people. 
                Voice commands for spiritual practices, fitness goals, business metrics. 
                It's like having a personal COO."
              </blockquote>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mr-4">
                  <span className="text-white font-bold">S</span>
                </div>
                <div>
                  <div className="font-semibold">Sarah Rodriguez</div>
                  <div className="text-sm text-gray-400">YC Founder, Former Google PM</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl md:text-6xl font-bold mb-8">
            Join the Operating System
          </h2>
          
          <p className="text-xl text-gray-300 mb-12 max-w-3xl mx-auto">
            Stop managing your life across 12 different apps. 
            Join builders who control everything through natural language.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-12">
            <button 
              onClick={onGetStarted}
              className="px-12 py-4 bg-gradient-to-r from-blue-500 to-cyan-400 text-white rounded-xl font-semibold text-lg transition-all duration-200 transform hover:scale-105 shadow-2xl"
            >
              Launch Dashboard
            </button>
            
            <div className="text-center">
              <div className="text-sm text-gray-400">Join 2,847 systematic thinkers</div>
              <div className="text-sm text-gray-500">No credit card • Start immediately</div>
            </div>
          </div>

          {/* Final stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-2xl mx-auto">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-400">300+</div>
              <div className="text-sm text-gray-400">AI Models Supported</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-400">24/7</div>
              <div className="text-sm text-gray-400">Voice Control</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-400">∞</div>
              <div className="text-sm text-gray-400">Life Categories</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 px-8 border-t border-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-lg flex items-center justify-center">
                <Code className="w-4 h-4 text-white" />
              </div>
              <span className="text-xl font-bold">Lifesurf</span>
            </div>
            <div className="text-gray-400 text-sm">
              © 2024 Lifesurf. The only life OS that works.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;