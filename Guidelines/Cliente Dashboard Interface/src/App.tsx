"use client";

import { useState, useEffect } from "react";
import { StatsCard } from "./components/StatsCard";
import { RecentActivityTable } from "./components/RecentActivityTable";
import { HoursDistributionChart } from "./components/HoursDistributionChart";
import { TeamMembersChart } from "./components/TeamMembersChart";
import { MonthlyConsumptionChart } from "./components/MonthlyConsumptionChart";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { Progress } from "./components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "./components/ui/avatar";
import { Badge } from "./components/ui/badge";
import {
  Clock,
  CheckCircle2,
  Zap,
  TrendingUp,
  MessageSquare,
  ArrowUpRight,
  Shield,
} from "lucide-react";
import { motion } from "motion/react";

export default function App() {
  const [progress, setProgress] = useState(0);

  // Datos del paquete
  const hoursContracted = 100;
  const hoursConsumed = 83;
  const hoursAvailable = hoursContracted - hoursConsumed;
  const progressPercentage = (hoursConsumed / hoursContracted) * 100;

  // Animación del progress bar
  useEffect(() => {
    const timer = setTimeout(() => setProgress(progressPercentage), 300);
    return () => clearTimeout(timer);
  }, [progressPercentage]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
      },
    },
  };

  return (
    <div className="min-h-screen bg-background dark">
      <div className="max-w-[1400px] mx-auto p-6 md:p-8 lg:p-12 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="size-1.5 rounded-full bg-primary animate-pulse" />
            <Badge variant="outline" className="border-primary/30 text-primary">
              Actualizado hoy
            </Badge>
          </div>
          
          <h1 className="text-foreground">Resumen del paquete contratado</h1>
          
          <p className="text-muted-foreground max-w-2xl">
            Aquí puedes ver en qué punto está tu proyecto y cómo avanzamos juntos 🚀
          </p>
        </motion.div>

        {/* PM Avatar Section */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Card className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-primary/20">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <Avatar className="size-14 border-2 border-primary/30">
                  <AvatarImage src="https://api.dicebear.com/7.x/avataaars/svg?seed=Ana" />
                  <AvatarFallback className="bg-primary text-primary-foreground">AL</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-foreground mb-1">
                    Hola Jordi, seguimos avanzando 👋
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Ana López · Project Manager
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          <motion.div variants={itemVariants}>
            <StatsCard
              title="Horas contratadas"
              value={hoursContracted}
              icon={Clock}
              subtitle="Paquete inicial"
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <StatsCard
              title="Horas consumidas"
              value={hoursConsumed}
              icon={CheckCircle2}
              subtitle={`${progressPercentage.toFixed(0)}% del total`}
            />
          </motion.div>
          <motion.div variants={itemVariants}>
            <StatsCard
              title="Horas disponibles"
              value={hoursAvailable}
              icon={Zap}
              subtitle="Listas para usar"
            />
          </motion.div>
        </motion.div>

        {/* Progress Bar Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <Card className="bg-card border-border">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-foreground">Progreso del paquete</h3>
                  <p className="text-muted-foreground text-sm mt-1">
                    {hoursConsumed} de {hoursContracted} horas utilizadas
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-[2rem] text-primary">
                    {progressPercentage.toFixed(0)}%
                  </div>
                </div>
              </div>
              <Progress value={progress} className="h-3" />
              <p className="text-muted-foreground text-xs">
                Última actualización: 29 de octubre de 2025
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Rhythm and Projection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="size-5 text-primary" />
                Ritmo y proyección
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <p className="text-muted-foreground text-sm">Velocidad de consumo</p>
                  <p className="text-[1.75rem] text-foreground">4h/semana</p>
                  <p className="text-muted-foreground text-sm">Promedio de las últimas 4 semanas</p>
                </div>
                <div className="space-y-2">
                  <p className="text-muted-foreground text-sm">Estimación de agotamiento</p>
                  <p className="text-[1.75rem] text-foreground">4,3 semanas</p>
                  <p className="text-muted-foreground text-sm">Al ritmo actual de trabajo</p>
                </div>
              </div>
              <div className="pt-4 border-t border-border">
                <Button className="w-full md:w-auto bg-primary text-primary-foreground hover:bg-primary/90">
                  Ampliar paquete de horas
                  <ArrowUpRight className="ml-2 size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Activity Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <RecentActivityTable />
        </motion.div>

        {/* Charts Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          <HoursDistributionChart />
          <div className="space-y-6">
            <TeamMembersChart />
            <MonthlyConsumptionChart />
          </div>
        </motion.div>

        {/* Transparency Block */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8 }}
        >
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="bg-primary/10 p-3 rounded-lg">
                  <Shield className="size-6 text-primary" />
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="text-foreground">Transparencia total</h3>
                  <p className="text-muted-foreground">
                    Cada hora registrada se asocia a una tarea concreta. Los datos se actualizan
                    automáticamente desde nuestro sistema de control horario, garantizando
                    precisión y claridad en todo momento.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Feedback Block */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.9 }}
        >
          <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
            <CardContent className="p-8">
              <div className="max-w-3xl mx-auto text-center space-y-4">
                <MessageSquare className="size-12 text-primary mx-auto" />
                <h3 className="text-foreground">
                  ¿Quieres priorizar una tarea o comentar algo sobre el progreso?
                </h3>
                <p className="text-muted-foreground">
                  Estamos aquí para adaptarnos a tus necesidades. No dudes en contactarnos.
                </p>
                <Button
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 mt-4"
                >
                  Enviar mensaje al equipo
                  <MessageSquare className="ml-2 size-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1 }}
          className="text-center py-8"
        >
          <p className="text-muted-foreground text-sm">
            © 2025 Tres Puntos Comunicación · Agencia de UX/UI
          </p>
        </motion.div>
      </div>
    </div>
  );
}
