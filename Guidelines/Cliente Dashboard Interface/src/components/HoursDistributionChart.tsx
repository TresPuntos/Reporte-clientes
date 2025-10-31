import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "./ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

// Datos agrupados por descripción de tarea
const data = [
  { name: "Diseño de wireframes", value: 18.5, color: "#5CFFBE" },
  { name: "Implementación de componentes", value: 22, color: "#7B68EE" },
  { name: "Reuniones de seguimiento", value: 8.5, color: "#FF6B9D" },
  { name: "Testing y ajustes", value: 15, color: "#FFD93D" },
  { name: "Documentación técnica", value: 12, color: "#6BCF7F" },
  { name: "Optimización de rendimiento", value: 7, color: "#FF8C42" },
];

const chartConfig = {
  hours: {
    label: "Horas",
  },
  "Diseño de wireframes": {
    label: "Diseño de wireframes",
    color: "#5CFFBE",
  },
  "Implementación de componentes": {
    label: "Implementación de componentes",
    color: "#7B68EE",
  },
  "Reuniones de seguimiento": {
    label: "Reuniones de seguimiento",
    color: "#FF6B9D",
  },
  "Testing y ajustes": {
    label: "Testing y ajustes",
    color: "#FFD93D",
  },
  "Documentación técnica": {
    label: "Documentación técnica",
    color: "#6BCF7F",
  },
  "Optimización de rendimiento": {
    label: "Optimización de rendimiento",
    color: "#FF8C42",
  },
};

export function HoursDistributionChart() {
  const totalHours = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle>Distribución de horas por descripción</CardTitle>
      </CardHeader>
      <CardContent className="pb-8">
        <div className="space-y-8">
          {/* Gráfico Donut */}
          <ChartContainer config={chartConfig} className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </ChartContainer>

          {/* Leyenda personalizada */}
          <div className="grid grid-cols-1 gap-3">
            {data.map((item, index) => {
              const percentage = ((item.value / totalHours) * 100).toFixed(1);
              return (
                <div
                  key={index}
                  className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className="size-3 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-foreground text-sm truncate">
                      {item.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-muted-foreground text-sm">
                      {percentage}%
                    </span>
                    <span className="text-foreground min-w-[3.5rem] text-right">
                      {item.value}h
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Total */}
          <div className="pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Total de horas</span>
              <span className="text-foreground text-lg">{totalHours}h</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
