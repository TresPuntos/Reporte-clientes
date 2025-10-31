import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "./ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from "recharts";
import { TrendingUp } from "lucide-react";

// Datos de consumo acumulado por mes
const data = [
  { month: "Ene", hours: 0, accumulated: 0 },
  { month: "Feb", hours: 12, accumulated: 12 },
  { month: "Mar", hours: 15, accumulated: 27 },
  { month: "Abr", hours: 18, accumulated: 45 },
  { month: "May", hours: 14, accumulated: 59 },
  { month: "Jun", hours: 11, accumulated: 70 },
  { month: "Jul", hours: 13, accumulated: 83 },
];

const chartConfig = {
  accumulated: {
    label: "Horas acumuladas",
    color: "#5CFFBE",
  },
  hours: {
    label: "Horas del mes",
    color: "#7B68EE",
  },
};

export function MonthlyConsumptionChart() {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Consumo acumulado por meses</CardTitle>
          <div className="flex items-center gap-2 text-primary text-sm">
            <TrendingUp className="size-4" />
            <span>83h totales</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorAccumulated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#5CFFBE" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#5CFFBE" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#3D3D3B"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                stroke="#BDBDBC"
                tick={{ fill: "#BDBDBC" }}
                tickLine={false}
                axisLine={{ stroke: "#3D3D3B" }}
              />
              <YAxis
                stroke="#BDBDBC"
                tick={{ fill: "#BDBDBC" }}
                tickLine={false}
                axisLine={{ stroke: "#3D3D3B" }}
                label={{
                  value: "Horas",
                  angle: -90,
                  position: "insideLeft",
                  style: { fill: "#BDBDBC", fontSize: 12 },
                }}
              />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                        <p className="text-foreground mb-2">
                          {payload[0].payload.month}
                        </p>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <div className="size-2 rounded-full bg-[#7B68EE]" />
                            <span className="text-muted-foreground text-sm">
                              Del mes:
                            </span>
                            <span className="text-foreground">
                              {payload[0].payload.hours}h
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="size-2 rounded-full bg-primary" />
                            <span className="text-muted-foreground text-sm">
                              Acumuladas:
                            </span>
                            <span className="text-foreground">
                              {payload[0].value}h
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="accumulated"
                stroke="#5CFFBE"
                strokeWidth={2}
                fill="url(#colorAccumulated)"
                animationDuration={1000}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>

        {/* Estadísticas adicionales */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-border">
          <div className="text-center">
            <p className="text-muted-foreground text-sm mb-1">Promedio mensual</p>
            <p className="text-foreground text-lg">13.8h</p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground text-sm mb-1">Mes con más horas</p>
            <p className="text-foreground text-lg">Abr (18h)</p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground text-sm mb-1">Tendencia</p>
            <div className="flex items-center justify-center gap-1">
              <TrendingUp className="size-4 text-primary" />
              <p className="text-foreground text-lg">Estable</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
