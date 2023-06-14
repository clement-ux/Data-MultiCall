// Import needed libraries
import fs from 'fs';
import { ethers } from 'ethers';
import { Multicall } from 'ethereum-multicall';
import gaugeAbi from "./abi/gauge.json" assert { type: "json" };
import gaugeControllerAbi from "./abi/gaugeController.json" assert { type: "json" };


// Add all the needed gauges here
const gaugeList = [
    "0x87012b0C3257423fD74a5986F81a0f1954C17a1d",
    "0x2e79D6f631177F8E7f08Fbd5110e893e1b1D790A"
]

// Users addresses (can be used for lockers too)
const addressesList = [
    "0x36cc7B13029B5DEe4034745FB4F24034f3F2ffc6", // Humpy 1
    "0x8a8743AFC23769d5B27Fb22af510DA3147BB9A55", // Humpy 2
    "0x9e9f535Da358Bf4f9cDc10A3D690DCF981956F68", // Humpy 3
    "0xc407e861f5a16256534B0c92fDD8220A35831840", // Humpy 4
    "0xc0a893145aD461AF44241A7DB5bb99B8998e7d2c", // Humpy 5
    "0xAE0BAF66E8f5Bb87A6fd54066e469cDfE93212Ec", // Humpy 6
    "0x014E61311e4DD2364CF6c0868C9978C5887deca8", // Humpy 7
    "0x1E7267fA2628d66538822Fc44f0EDb62b07272A4", // Humpy 8
    "0x8b781a032c0FF967d2786A66afB1dbd5128FC382", // Humpy 9
]

// Names for the addresses above (not necessary)
const addressesNameList = ["Humpy 1", "Humpy 2", "Humpy 3", "Humpy 4", "Humpy 5", "Humpy 6", "Humpy 7", "Humpy 8", "Humpy 9"]

const gaugeController = "0xC128468b7Ce63eA702C1f104D55A2566b13D3ABD";

// Timestamp to use for calling the method "getCappedRelativeWeight" on the gauge
// Use 0 to get the current value, otherwise use a timestamp in the past
const timestamp = 0;

// RPC node to use for the Ethereum mainnet
const rpcNode = "https://ethereum.publicnode.com"//"https://eth.llamarpc.com";

// getCappedRelativeWeight and getRelativeWeightCap are given in percentage

/**
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 */
////////////////////////////////////////////////////////////////
/// --- NOTHING TO CHANGE BELOW THIS LINE!! --- ////////////////
////////////////////////////////////////////////////////////////
/**
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 */

// Store the number of seconds in a week
const WEEK = 7 * 24 * 60 * 60;

// Get the actual timestamp or use the one provided
const ts = timestamp == 0 ? Math.floor(Date.now() / 1000) : timestamp;

// Create a provider for the Ethereum mainnet, using public Llama RPC node
const provider = new ethers.providers.JsonRpcProvider(rpcNode);

// Mapping from addresses to names
const addressesNameMapping = {};
// Do the mapping
mapp();

// Remove useless words from the Gauge name 
const wordsToRemove = ["Gauge", "Deposit"];

// Create a new instance of the multicall object
const multicall = new Multicall({ ethersProvider: provider, tryAggregate: true });

// Create a contract call context for each gauge
const gaugeMultiCall = gaugeList.map((gauge) => {
    // Create a contract call context for each address
    const balanceOfCall = addressesList.map((address) => {
        return { reference: "balanceOf: " + (addressesNameMapping[address] != undefined ? addressesNameMapping[address] : address), methodName: 'balanceOf', methodParameters: [address] }
    })
    const workingBalancefCall = addressesList.map((address) => {
        return { reference: "workingBlances: " + (addressesNameMapping[address] != undefined ? addressesNameMapping[address] : address), methodName: 'working_balances', methodParameters: [address] }
    })

    return {
        reference: gauge,
        contractAddress: gauge,
        abi: gaugeAbi,
        calls: [
            // Call for Gauge Name
            { reference: 'name', methodName: 'name' },
            // Cal for Total Supply
            { reference: 'totalSupply', methodName: 'totalSupply' },
            // Call for Working Supply
            { reference: 'workingSupply', methodName: 'working_supply' },
            // Call for Relative Weight
            { reference: 'getCappedRelativeWeight', methodName: 'getCappedRelativeWeight', methodParameters: [ts] },
            // Call for Relative Weight Cap
            { reference: 'getRelativeWeightCap', methodName: 'getRelativeWeightCap' },
            // Call for user balances
            ...balanceOfCall,
            // Call for user working balances
            ...workingBalancefCall
        ]
    }
}
);

// Create a contract call context for each gauge
const gaugeControllerMultiCall = gaugeList.map((gauge) => {
    // Create a contract call context for each address
    const lastUserVoteCall = addressesList.map((address) => {
        return { reference: "nextVoteUnlock: " + (addressesNameMapping[address] != undefined ? addressesNameMapping[address] : address), methodName: 'last_user_vote', methodParameters: [address, gauge] }
    })
    const voteSlopeCall = addressesList.map((address) => {
        return { reference: "voteWeight: " + (addressesNameMapping[address] != undefined ? addressesNameMapping[address] : address), methodName: 'vote_user_slopes', methodParameters: [address, gauge] }
    })

    return {
        reference: gauge,
        contractAddress: gaugeController,
        abi: gaugeControllerAbi,
        calls: [
            ...lastUserVoteCall,
            ...voteSlopeCall,
            { reference: 'total', methodName: 'points_weight', methodParameters: [gauge, convertToCurrentPeriod(ts)] }
        ]
    }
}
);

// Execute the multicall
const results = await multicall.call(gaugeMultiCall);
const results2 = await multicall.call(gaugeControllerMultiCall);

// Create an empyt object with the results
let objectResults = {};

// Loop through the results and add them to the object
Object.keys(results.results).forEach((key) => {
    // cache result
    let result = results.results[key];
    // cache name
    let name = result.callsReturnContext[0].returnValues[0];
    name = !!name?.length ? removeWords(name) : key;

    // Initialize the object
    objectResults[name] = {};

    // Add first the name
    objectResults[name].name = result.callsReturnContext.find((call) => call.reference == 'name').returnValues[0];

    // Loop through the results and add them to the object
    objectResults[name].address = key;

    // Loop through the results and add them to the object for first multicall
    result.callsReturnContext.filter((call) => call.reference != 'name').forEach((call) => {
        objectResults[name][call.reference] = format(call.returnValues[0] || 0, call.methodName);
    });

    // Loop through the results and add them to the object for second multicall
    results2.results[key].callsReturnContext.forEach((call) => {
        if (call.reference.includes("voteWeight")) {
            objectResults[name][call.reference] = getVotingPower(call.returnValues[0], call.returnValues[2], convertToCurrentPeriod(ts));
        } else if (call.reference.includes("lastTimeUserVote")) {
            objectResults[name][call.reference] = format(call.returnValues[0], call.methodName);
        }
        else objectResults[name][call.reference] = format(call.returnValues[0], call.methodName);//parseFloat(ethers.utils.formatUnits(call.returnValues[0], 0));
    });

});

////////////////////////////////////////////////////////////////
/// --- FUNCTIONS --- //////////////////////////////////////////
////////////////////////////////////////////////////////////////

// Function to do the mapping between addresses and names
function mapp() {
    for (let i = 0; i < addressesList.length; i++) {
        addressesNameMapping[addressesList[i]] = addressesNameList[i];
    }
}

// Function to remove words from a string
function removeWords(text) {
    let words = text.split(" ");
    let newWords = words.filter(word => !wordsToRemove.includes(word));
    let newText = newWords.join(" ");
    return newText;

}

// Function to format the results
function format(value, method) {
    switch (value.type) {
        case "BigNumber":
            if (method == "getCappedRelativeWeight" || method == 'getRelativeWeightCap') return parseFloat(ethers.utils.formatUnits(value, 15));
            if (method == "last_user_vote" && ethers.utils.formatUnits(value, 0) != 0) {
                const date = new Date((parseFloat(ethers.utils.formatUnits(value, 0)) + 10 * 24 * 60 * 60) * 1000);
                return date.getDate() + "/" + (date.getMonth() + 1) + "/" + date.getFullYear() + " " + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
            }
            else return parseFloat(ethers.utils.formatEther(value));
        default:
            return value;

    }
}

// Function that calculates the voting power
function getVotingPower(slope, end, currentPeriod) {
    slope = ethers.utils.formatUnits(slope, 0)
    end = ethers.utils.formatUnits(end, 0)
    currentPeriod = ethers.utils.formatUnits(currentPeriod, 0)
    if (currentPeriod + WEEK > end) return 0;
    return slope * (end - currentPeriod);
}

// Function to convert a timestamp to the current period
function convertToCurrentPeriod(timestamp) {
    return Math.floor(timestamp / WEEK) * WEEK;
}

// Write the object to a JSON file
fs.writeFile('data.json', JSON.stringify(objectResults), 'utf8', () => { });
