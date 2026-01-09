import React from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { ExternalLink, BarChart3, Activity, Database, FileText } from "lucide-react";

interface Tool {
  label: string;
  url: string;
  desc: string;
  icon: React.ReactNode;
  category: string;
  color: string;
}

const tools: Tool[] = [
  { 
    label: "Grafana", 
    url: "http://localhost:3002", 
    desc: "Dashboards, Loki logs, and Prometheus metrics visualization",
    icon: <BarChart3 className="h-8 w-8" />,
    category: "Observability",
    color: "from-orange-500 to-red-600"
  },
  { 
    label: "Prometheus", 
    url: "http://localhost:9091", 
    desc: "Metrics collection and time-series database explorer",
    icon: <Activity className="h-8 w-8" />,
    category: "Monitoring",
    color: "from-red-500 to-orange-600"
  },
  { 
    label: "Loki", 
    url: "http://localhost:3101", 
    desc: "Log aggregation system and query API",
    icon: <FileText className="h-8 w-8" />,
    category: "Logging",
    color: "from-yellow-500 to-orange-600"
  },
  { 
    label: "MinIO Console", 
    url: "http://localhost:9001", 
    desc: "S3-compatible object storage management console",
    icon: <Database className="h-8 w-8" />,
    category: "Storage",
    color: "from-blue-500 to-purple-600"
  },
];

export default function ToolsLinksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Platform Tools</h2>
        <p className="text-muted-foreground">Access monitoring, observability, and storage tools</p>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6">
        {tools.map((tool) => (
          <Card 
            key={tool.label} 
            className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/50"
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className={`rounded-xl bg-gradient-to-br ${tool.color} p-3 text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    {tool.icon}
                  </div>
                  <div>
                    <CardTitle className="text-xl">{tool.label}</CardTitle>
                    <CardDescription className="mt-1">
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                        {tool.category}
                      </span>
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {tool.desc}
              </p>
              <Button 
                asChild 
                className="w-full group-hover:shadow-lg transition-shadow"
                size="lg"
              >
                <a href={tool.url} target="_blank" rel="noreferrer">
                  Open Tool
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
