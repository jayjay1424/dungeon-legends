"use client";


import { useEffect } from "react";
import { useRouter } from "next/navigation";

import styles from "./dashboard.module.css";



export default function Dashboard(){


    const router = useRouter();



    useEffect(()=>{

        import("./lobby.js");

    },[]);





    function logout(){

        router.push("/login");

    }





    return (

        <main className={styles.lobby}>


            <div className={styles.fog}></div>




            <section className={styles.topbar}>


                <h1>
                    DUNGEON LEGENDS
                </h1>



                <button

                onClick={logout}

                className={styles.logout}

                >

                    LOGOUT

                </button>


            </section>







            <section className={styles.heroArea}>


                <div className={styles.pixelHero}>


                    <div className={styles.head}></div>

                    <div className={styles.body}></div>

                    <div className={styles.legs}></div>


                </div>




                <h2>

                    HERO LVL 1

                </h2>


                <p>

                    ⚔ Rookie Dungeon Adventurer

                </p>


            </section>







            <section className={styles.modeArea}>


                <h2>

                    SELECT MODE

                </h2>





                <div className={styles.cards}>



                    <div

                    className={styles.card}

                    onClick={()=>router.push("/survival")}

                    >

                        <h3>

                            ⚔ SURVIVAL MODE

                        </h3>



                        <p>

                            Survive endless dungeon waves.

                        </p>



                        <button>

                            ENTER

                        </button>



                    </div>








                    <div

                    className={styles.card}

                    onClick={()=>router.push("/defense")}

                    >


                        <h3>

                            🏰 DEFENSE MODE

                        </h3>



                        <p>

                            Protect the dungeon crystal.

                        </p>




                        <button>

                            ENTER

                        </button>



                    </div>




                </div>



            </section>








            <nav className={styles.menu}>


                <button>

                    ⚔

                    <br/>

                    CHARACTER

                </button>




                <button>

                    🎒

                    <br/>

                    INVENTORY

                </button>




                <button>

                    🐉

                    <br/>

                    COMPANIONS

                </button>




                <button>

                    📜

                    <br/>

                    QUEST

                </button>



            </nav>





        </main>


    );


}