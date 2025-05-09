import { useState, useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import PresaleFactoryJson from "@/abis/PresaleFactory.json";
import PresaleJson from "@/abis/Presale.json"; // Added missing import
import { type Abi, erc20Abi } from "viem"; // Added missing erc20Abi
import PresaleCard from "@/components/presale/PresaleCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { getPresaleStatus } from "@/lib/utils"; // Keep for filtering logic
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const factoryAbi = PresaleFactoryJson.abi as Abi;
const presaleAbi = PresaleJson.abi as Abi; // Defined presaleAbi
const factoryAddress = import.meta.env.VITE_PRESALE_FACTORY_ADDRESS as `0x${string}`;

const ITEMS_PER_PAGE = 10;

// Animation variants
const containerVariants = { hidden: { opacity: 0 }, visible: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemVariants = { hidden: { y: 20, opacity: 0 }, visible: { y: 0, opacity: 1 } };
const fabVariants = { hover: { scale: 1.1 }, tap: { scale: 0.9 } };

// Skeleton Card Component
const PresaleCardSkeleton = () => (
    <Card className="animate-pulse"><CardHeader className="flex flex-row items-center gap-3"><Skeleton className="h-10 w-10 rounded-full" /><div className="flex-1 space-y-1"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-3 w-full" /></div><Skeleton className="h-5 w-16" /></CardHeader><CardContent className="space-y-2 pt-4"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-2/3" /><Skeleton className="h-3 w-full mt-2" /></CardContent></Card>
);

// Define the structure of the presale object after combining data
interface PresaleWithDetails {
    address: `0x${string}`;
    options: any; // Replace 'any' with a more specific type if possible
    state: number | undefined;
    tokenSymbol: string | undefined;
}

const PresaleListPage = () => {
    const [currentPage, setCurrentPage] = useState(1);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterStatus, setFilterStatus] = useState("all");

    // --- Data Fetching Logic ---
    const { data: allPresaleAddressesResult, isLoading: isLoadingAddresses } = useReadContract({
        address: factoryAddress,
        abi: factoryAbi,
        functionName: "getAllPresales",
        query: { staleTime: 300_000 } // Cache for 5 minutes
    });
    const allPresaleAddresses = ((allPresaleAddressesResult as `0x${string}`[] | undefined) ?? []).slice().reverse();

    const allPresaleDetailsContracts = useMemo(() => {
        return allPresaleAddresses.flatMap(addr => [
            {
                address: addr,
                abi: presaleAbi,
                functionName: "options",
            },
            {
                address: addr,
                abi: presaleAbi,
                functionName: "state",
            },
            {
                address: addr,
                abi: presaleAbi,
                functionName: "token", // Add call to fetch token address
            }
        ]);
    }, [allPresaleAddresses]);

    const { data: allPresaleDetailsResults, isLoading: isLoadingDetails } = useReadContracts({
        allowFailure: true,
        contracts: allPresaleDetailsContracts,
        query: { enabled: allPresaleAddresses.length > 0 },
        // batchSize: 20, // wagmi v2 does not have batchSize, it's automatic
    });

    const allTokenSymbolContracts = useMemo(() => {
        if (!allPresaleDetailsResults || allPresaleDetailsResults.length !== allPresaleAddresses.length * 3) return []; // Adjusted length check for 3 calls per presale
        return allPresaleAddresses.map((_address, index) => {
            const tokenResult = allPresaleDetailsResults[index * 3 + 2]; 
            const tokenAddress = tokenResult?.result as `0x${string}` | undefined;
            if (tokenResult?.status === 'success' && tokenAddress) {
                return {
                    address: tokenAddress,
                    abi: erc20Abi,
                    functionName: "symbol",
                };
            }
            return null; 
        }).filter(contract => contract !== null) as any[]; 
    }, [allPresaleAddresses, allPresaleDetailsResults]);

    const { data: allTokenSymbolResults, isLoading: isLoadingSymbols } = useReadContracts({
        allowFailure: true,
        contracts: allTokenSymbolContracts,
        query: { enabled: allTokenSymbolContracts.length > 0 },
        // batchSize: 20, // wagmi v2 does not have batchSize
    });

    const presalesWithDetails: PresaleWithDetails[] = useMemo(() => {
        if (!allPresaleDetailsResults || !allTokenSymbolResults || allPresaleDetailsResults.length !== allPresaleAddresses.length * 3 ) { 
            return [];
        }
        
        // Create a map for quick lookup of token symbols by their address
        const tokenSymbolMap = new Map<`0x${string}`, string | undefined>();
        allTokenSymbolContracts.forEach((contractDef, i) => {
            if (contractDef && allTokenSymbolResults[i]?.status === 'success') {
                tokenSymbolMap.set(contractDef.address, allTokenSymbolResults[i].result as string | undefined);
            }
        });

        return allPresaleAddresses.map((address, index) => {
            const optionsResult = allPresaleDetailsResults[index * 3];     
            const stateResult = allPresaleDetailsResults[index * 3 + 1];   
            const tokenResult = allPresaleDetailsResults[index * 3 + 2];   

            if (optionsResult?.status !== 'success' || stateResult?.status !== 'success' || tokenResult?.status !== 'success') {
                return null; 
            }

            const options = optionsResult.result as any;
            const state = stateResult.result as number | undefined;
            const tokenAddress = tokenResult.result as `0x${string}` | undefined;
            const tokenSymbol = tokenAddress ? tokenSymbolMap.get(tokenAddress) : undefined;

            return { address, options, state, tokenSymbol };
        }).filter((p): p is PresaleWithDetails => p !== null); 
    }, [allPresaleAddresses, allPresaleDetailsResults, allTokenSymbolResults, allTokenSymbolContracts]);

    // Filtering Logic
    const filteredPresales = useMemo(() => {
        return presalesWithDetails.filter(presale => {
            const statusObject = getPresaleStatus(presale.state, presale.options);
            // Use statusObject.text for filtering, ensuring it's lowercase for case-insensitive comparison
            const matchesStatus = filterStatus === "all" || statusObject.text.toLowerCase().includes(filterStatus.toLowerCase());
            const matchesSearch = searchTerm === "" ||
                                  presale.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                  (presale.tokenSymbol && presale.tokenSymbol.toLowerCase().includes(searchTerm.toLowerCase()));
            return matchesStatus && matchesSearch;
        });
    }, [presalesWithDetails, searchTerm, filterStatus]);

    const totalPages = Math.ceil(filteredPresales.length / ITEMS_PER_PAGE);
    const paginatedPresales = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        return filteredPresales.slice(startIndex, endIndex);
    }, [filteredPresales, currentPage]);

    const handlePageChange = (newPage: number) => { if (newPage >= 1 && newPage <= totalPages) { setCurrentPage(newPage); } };
    const isLoading = isLoadingAddresses || isLoadingDetails || isLoadingSymbols;

    return (
        <div className="space-y-6 relative pb-20"> 
             <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h1 className="text-3xl font-bold self-start md:self-center">Presales</h1>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
                    <Input 
                        placeholder="Search Address or Symbol..." 
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        className="w-full md:w-64"
                    />
                    <Select value={filterStatus} onValueChange={(value) => { setFilterStatus(value); setCurrentPage(1); }}>
                        <SelectTrigger className="w-full md:w-[180px]">
                            <SelectValue placeholder="Filter by Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="upcoming">Upcoming</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="ended (success)">Ended (Success)</SelectItem> {/* Match text from getPresaleStatus */}
                            <SelectItem value="ended (failed)">Ended (Failed)</SelectItem> {/* Match text from getPresaleStatus */}
                            <SelectItem value="ended (processing)">Ended (Processing)</SelectItem> {/* Match text from getPresaleStatus */}
                            <SelectItem value="canceled">Canceled</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={isLoading ? "loading" : currentPage + filterStatus + searchTerm}
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" 
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                >
                    {isLoading ? (
                        [...Array(ITEMS_PER_PAGE)].map((_, i) => (
                            <motion.div key={`skeleton-${i}`} variants={itemVariants}>
                                <PresaleCardSkeleton />
                            </motion.div>
                        ))
                    ) : paginatedPresales.length > 0 ? (
                        paginatedPresales.map(presale => (
                            <motion.div key={presale.address} variants={itemVariants}>
                                <PresaleCard presaleAddress={presale.address} />
                            </motion.div>
                        ))
                    ) : (
                        <motion.p 
                            className="text-center text-muted-foreground py-10 col-span-1 md:col-span-2 lg:col-span-3"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            No presales found matching your criteria.
                        </motion.p>
                    )}
                </motion.div>
            </AnimatePresence>

            {!isLoading && totalPages > 1 && (
                 <div className="flex justify-center items-center space-x-2 pt-4">
                    <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>Previous</Button>
                    <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                    <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>Next</Button>
                </div>
            )}

            <motion.div className="fixed bottom-6 right-6 z-50" variants={fabVariants} whileHover="hover" whileTap="tap">
                <Link to="/create" className="bg-primary text-primary-foreground rounded-full p-3 shadow-lg flex items-center justify-center" aria-label="Create Presale">
                    <Plus className="h-6 w-6" />
                </Link>
            </motion.div>
        </div>
    );
};

export default PresaleListPage;

