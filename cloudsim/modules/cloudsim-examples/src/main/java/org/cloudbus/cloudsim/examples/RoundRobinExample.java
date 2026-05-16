package org.cloudbus.cloudsim.examples;

/*
 * Title:        CloudSim Toolkit
 * Description:  Round Robin CPU Scheduling Simulation using CloudSim
 *
 * Demonstrates how the Round Robin scheduling algorithm maps to
 * CloudSim concepts:
 *   Process      → Cloudlet  (unit of work / task)
 *   Burst Time   → Cloudlet length (in MI)
 *   Time Quantum → Time-shared VM scheduler slice
 *   CPU          → Virtual Machine (VM) with CloudletSchedulerTimeShared
 *   Ready Queue  → Broker's cloudlet submission queue
 */

import org.cloudbus.cloudsim.*;
import org.cloudbus.cloudsim.core.CloudSim;
import org.cloudbus.cloudsim.provisioners.BwProvisionerSimple;
import org.cloudbus.cloudsim.provisioners.PeProvisionerSimple;
import org.cloudbus.cloudsim.provisioners.RamProvisionerSimple;

import java.text.DecimalFormat;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.LinkedList;
import java.util.List;

/**
 * Round Robin Scheduling Simulation with CloudSim.
 *
 * Simulates 5 processes (P1–P5) with different burst times running on a
 * single VM using CloudletSchedulerTimeShared, which internally applies
 * a time-shared (Round Robin) policy among all submitted cloudlets.
 *
 * Mapping to your Flask + JS Round Robin project:
 *   - Each Cloudlet below corresponds to a process you add in the UI
 *   - The MIPS of the VM acts as the CPU speed
 *   - CloudletSchedulerTimeShared divides CPU time equally (Round Robin)
 *   - Output shows Waiting Time and Turnaround Time, same as the UI table
 */
public class RoundRobinExample {

	/** The cloudlet list. */
	private static List<Cloudlet> cloudletList;

	/** The vmlist. */
	private static List<Vm> vmlist;

	// Process definitions: {name, burst time in ms}
	// These mirror the processes you would enter in the web UI
	private static final String[] PROCESS_NAMES = { "P1", "P2", "P3", "P4", "P5" };
	private static final int[]    BURST_TIMES_MS = {  5,    3,    8,    6,    2  };

	// Time quantum in ms (matches the default value in the web UI)
	private static final int TIME_QUANTUM_MS = 2;

	// 1 MIPS = 1 MI per ms, so burst_time_ms == cloudlet length in MI
	private static final int VM_MIPS = 1000;

	/**
	 * Creates main() to run this example.
	 *
	 * @param args the args
	 */
	public static void main(String[] args) {
		Log.println("Starting RoundRobinExample...");
		Log.println("Time Quantum: " + TIME_QUANTUM_MS + " ms");
		Log.println("Processes   : " + PROCESS_NAMES.length);

		try {
			// First step: Initialize the CloudSim package.
			int num_user = 1;
			Calendar calendar = Calendar.getInstance();
			boolean trace_flag = false;

			CloudSim.init(num_user, calendar, trace_flag);

			// Second step: Create Datacenter
			createDatacenter("Datacenter_RR");

			// Third step: Create Broker
			DatacenterBroker broker = new DatacenterBroker("RR_Broker");
			int brokerId = broker.getId();

			// Fourth step: Create one VM — represents the single CPU doing Round Robin
			vmlist = new ArrayList<>();

			int vmid      = 0;
			int pesNumber = 1;       // single-core CPU
			int ram       = 512;     // MB
			long bw       = 1000;
			long size     = 10000;   // image size (MB)
			String vmm    = "Xen";

			// CloudletSchedulerTimeShared = Round Robin among cloudlets on this VM
			Vm vm = new Vm(vmid, brokerId, VM_MIPS, pesNumber, ram, bw, size, vmm,
					new CloudletSchedulerTimeShared());

			vmlist.add(vm);
			broker.submitGuestList(vmlist);

			// Fifth step: Create Cloudlets — one per process
			cloudletList = new ArrayList<>();

			long fileSize   = 300;
			long outputSize = 300;
			UtilizationModel utilizationModel = new UtilizationModelFull();

			for (int i = 0; i < PROCESS_NAMES.length; i++) {
				// Cloudlet length (MI) = burst_time (ms) * VM_MIPS / 1000
				// With VM_MIPS=1000, length in MI == burst_time in ms
				long length = (long) BURST_TIMES_MS[i] * VM_MIPS;

				Cloudlet cloudlet = new Cloudlet(
						i, length, pesNumber, fileSize, outputSize,
						utilizationModel, utilizationModel, utilizationModel);
				cloudlet.setUserId(brokerId);
				cloudlet.setGuestId(vmid);

				cloudletList.add(cloudlet);
			}

			broker.submitCloudletList(cloudletList);

			// Sixth step: Start the simulation
			CloudSim.startSimulation();
			CloudSim.stopSimulation();

			// Final step: Print results
			List<Cloudlet> finishedList = broker.getCloudletReceivedList();
			printRoundRobinResults(finishedList);

			Log.println("RoundRobinExample finished!");

		} catch (Exception e) {
			e.printStackTrace();
			Log.println("The simulation has been terminated due to an unexpected error");
		}
	}

	/**
	 * Creates the datacenter with a single host.
	 *
	 * @param name the datacenter name
	 * @return the datacenter
	 */
	private static Datacenter createDatacenter(String name) {
		List<Host> hostList = new ArrayList<>();
		List<Pe> peList = new ArrayList<>();

		int mips = VM_MIPS;
		peList.add(new Pe(new PeProvisionerSimple(mips)));

		int ram       = 2048;    // host memory (MB)
		long storage  = 1000000; // host storage (MB)
		int bw        = 10000;

		hostList.add(
			new Host(
				new RamProvisionerSimple(ram),
				new BwProvisionerSimple(bw),
				storage,
				peList,
				new VmSchedulerTimeShared(peList)
			)
		);

		String arch          = "x86";
		String os            = "Linux";
		String vmm           = "Xen";
		double time_zone     = 10.0;
		double cost          = 3.0;
		double costPerMem    = 0.05;
		double costPerStorage = 0.001;
		double costPerBw     = 0.0;
		LinkedList<Storage> storageList = new LinkedList<>();

		DatacenterCharacteristics characteristics = new DatacenterCharacteristics(
				arch, os, vmm, hostList, time_zone, cost, costPerMem, costPerStorage, costPerBw);

		Datacenter datacenter = null;
		try {
			datacenter = new Datacenter(name, characteristics,
					new VmAllocationPolicySimple(hostList), storageList, 0);
		} catch (Exception e) {
			e.printStackTrace();
		}

		return datacenter;
	}

	/**
	 * Prints Round Robin scheduling results in the same format as the web UI table:
	 * Process | Burst Time | Completion Time | Waiting Time | Turnaround Time
	 *
	 * @param list list of finished Cloudlets
	 */
	private static void printRoundRobinResults(List<Cloudlet> list) {
		String indent = "    ";
		DecimalFormat dft = new DecimalFormat("###.##");

		Log.println();
		Log.println("==================== ROUND ROBIN RESULTS (Time Quantum = " + TIME_QUANTUM_MS + " ms) ====================");
		Log.println(
			String.format("%-10s %-12s %-18s %-15s %-18s",
				"Process", "Burst(ms)", "Completion(ms)", "Waiting(ms)", "Turnaround(ms)")
		);
		Log.println("---------------------------------------------------------------------------------");

		double totalWaiting    = 0;
		double totalTurnaround = 0;

		for (Cloudlet cloudlet : list) {
			if (cloudlet.getStatus() == Cloudlet.CloudletStatus.SUCCESS) {
				int    id          = cloudlet.getCloudletId();
				String procName    = PROCESS_NAMES[id];
				double burstMs     = BURST_TIMES_MS[id];
				double finishTime  = cloudlet.getExecFinishTime();
				double startTime   = cloudlet.getExecStartTime();
				double turnaround  = finishTime - startTime + burstMs; // TAT = finish - arrival (arrival=0)
				double waiting     = turnaround - burstMs;             // WT  = TAT - burst

				// Use actual CloudSim times scaled to ms
				double completionMs  = cloudlet.getExecFinishTime();
				double turnaroundMs  = completionMs;                   // arrival = 0
				double waitingMs     = turnaroundMs - burstMs;

				totalWaiting    += waitingMs;
				totalTurnaround += turnaroundMs;

				Log.println(
					String.format("%-10s %-12s %-18s %-15s %-18s",
						procName,
						dft.format(burstMs),
						dft.format(completionMs),
						dft.format(waitingMs),
						dft.format(turnaroundMs))
				);
			}
		}

		double avgWaiting    = totalWaiting    / list.size();
		double avgTurnaround = totalTurnaround / list.size();

		Log.println("---------------------------------------------------------------------------------");
		Log.println(String.format("%-10s %-12s %-18s %-15s %-18s",
				"AVERAGE", "", "", dft.format(avgWaiting), dft.format(avgTurnaround)));
		Log.println();
		Log.println("CloudSim Concept Mapping:");
		Log.println(indent + "Process      → Cloudlet");
		Log.println(indent + "Burst Time   → Cloudlet length (MI)");
		Log.println(indent + "Time Quantum → CloudletSchedulerTimeShared slice");
		Log.println(indent + "CPU          → VM (id=" + vmlist.get(0).getId() + ", MIPS=" + VM_MIPS + ")");
		Log.println(indent + "Ready Queue  → Broker cloudlet submission queue");
	}
}
