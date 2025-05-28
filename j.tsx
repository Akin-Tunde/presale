// src/pages/CreatePresalePage.tsx (Refactored for UI/UX + Bugfixes)
import React, {
  useState,
  useEffect,
  useCallback,
  ChangeEvent,
} from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  useAccount,
  useConnect,
  useWriteContract,
  useReadContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther, isAddress, zeroAddress, zeroHash, formatUnits, parseUnits } from "viem";
import { createClient } from "@supabase/supabase-js";
import { sepolia } from "viem/chains";
import { createConfig, http } from "@wagmi/core";
import { getPublicClient } from "@wagmi/core";
import { toast } from "sonner";
import { factoryAbi, erc20Abi } from "@/abis/Abi"; // Assuming Abi.ts exports these

// Import Shadcn UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import {
  Info,
  HelpCircle,
  Loader2,
  CheckCircle,
  XCircle,
  CalendarIcon,
} from "lucide-react";
import { format } from "date-fns";

// Supabase client setup
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL or Anon Key is missing in environment variables.");
  // Handle this error appropriately in your UI, maybe disable Supabase features
}

export const supabase = createClient(supabaseUrl!, supabaseAnonKey!); // Use non-null assertion if you handle the error elsewhere