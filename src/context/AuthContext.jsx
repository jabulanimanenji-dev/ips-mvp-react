import React, {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect
} from 'react';

import { useLocalStorage } from '../hooks/useLocalStorage';


const AuthContext = createContext();



export function AuthProvider({ children }) {


  const [
    user,
    setUser,
    removeUser
  ] = useLocalStorage(
    'ips-user',
    null
  );


  const [
    admin,
    setAdmin,
    removeAdmin
  ] = useLocalStorage(
    'ips-admin-session',
    null
  );


  const [
    writer,
    setWriter,
    removeWriter
  ] = useLocalStorage(
    'ips-writer-session',
    null
  );



  const [loading, setLoading] =
    useState(true);



  useEffect(() => {

    // Allow stored sessions to load
    // before protected routes check auth

    const timer =
      setTimeout(() => {
        setLoading(false);
      }, 100);


    return () =>
      clearTimeout(timer);


  }, []);






  // ==========================
  // CLIENT LOGIN
  // ==========================

  const loginClient = useCallback(
    async (email, password) => {

      try {

        const response =
          await fetch(
            '/api/client/login',
            {
              method:'POST',

              headers:{
                'Content-Type':
                  'application/json'
              },

              body:
                JSON.stringify({
                  email,
                  password
                })
            }
          );



        const data =
          await response.json();



        if (data.success) {

          setUser(
            data.client
          );


          return {
            success:true
          };

        }



        return {
          success:false,
          error:
            data.message ||
            'Invalid credentials'
        };


      } catch(err) {


        return {
          success:false,
          error:
            'Server error'
        };

      }


    },
    [setUser]
  );







  // ==========================
  // CLIENT SIGNUP
  // ==========================

  const signupClient =
    useCallback(
      async (
        name,
        email,
        password
      ) => {


        try {


          const response =
            await fetch(
              '/api/clients',
              {
                method:'POST',

                headers:{
                  'Content-Type':
                    'application/json'
                },

                body:
                  JSON.stringify({
                    full_name:name,
                    email,
                    password
                  })
              }
            );



          const data =
            await response.json();



          if(data.success){

            setUser(
              data.client
            );


            return {
              success:true
            };

          }



          return {
            success:false,
            error:
              data.error ||
              data.message ||
              'Signup failed'
          };



        } catch(err){


          return {
            success:false,
            error:
              'Server error'
          };


        }


      },
      [setUser]
    );







  // ==========================
  // ADMIN LOGIN
  // ==========================

  const loginAdmin =
    useCallback(
      async (
        email,
        password
      ) => {


        try {


          const response =
            await fetch(
              '/api/admin/login',
              {
                method:'POST',

                headers:{
                  'Content-Type':
                    'application/json'
                },

                body:
                  JSON.stringify({
                    email,
                    password
                  })
              }
            );



          const data =
            await response.json();



          if(data.success){


            setAdmin({

              email,

              name:
                'Super Admin',

              role:
                data.role,

              token:
                data.token

            });



            return {
              success:true
            };

          }



          return {
            success:false,
            error:
              data.message ||
              'Invalid credentials'
          };



        } catch(err){


          return {
            success:false,
            error:
              'Server error'
          };


        }


      },
      [setAdmin]
    );







  // ==========================
  // WRITER LOGIN
  // ==========================


  const loginWriter =
    useCallback(
      async (
        email,
        password
      ) => {


        try {


          const response =
            await fetch(
              '/api/writer/login',
              {
                method:'POST',

                headers:{
                  'Content-Type':
                    'application/json'
                },

                body:
                  JSON.stringify({
                    email,
                    password
                  })
              }
            );



          const data =
            await response.json();



          if(data.success){


            setWriter({

              ...data.writer,

              token:
                data.token

            });



            return {
              success:true
            };

          }



          return {
            success:false,
            error:
              data.message ||
              'Invalid credentials'
          };



        } catch(err){


          return {
            success:false,
            error:
              'Server error'
          };


        }


      },
      [setWriter]
    );








  const logout =
    useCallback(() => {

      removeUser();

      removeAdmin();

      removeWriter();


    }, [
      removeUser,
      removeAdmin,
      removeWriter
    ]);







  return (

    <AuthContext.Provider

      value={{

        user,

        admin,

        writer,

        loading,

        loginClient,

        signupClient,

        loginAdmin,

        loginWriter,

        logout

      }}

    >

      {children}

    </AuthContext.Provider>

  );

}




export const useAuth =
  () =>
    useContext(AuthContext);
